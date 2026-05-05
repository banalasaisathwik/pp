const express = require("express");
const router = express.Router();
const axios = require("axios");
const Image = require("../models/Image");
const Article = require("../models/Article");

const DEFAULT_PHASH_BITS = 64;
const DEFAULT_SIMILARITY_THRESHOLD = 85;
const DEFAULT_REGION_SIMILARITY_THRESHOLD = 90;

function normalizeHash(hash) {
  return typeof hash === "string" ? hash.trim().toLowerCase() : "";
}

function clampPercentage(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function countSetBits(value) {
  let bits = 0;
  let current = value;

  while (current > 0n) {
    bits += Number(current & 1n);
    current >>= 1n;
  }

  return bits;
}

function hammingDistance(hash1, hash2) {
  const left = normalizeHash(hash1);
  const right = normalizeHash(hash2);

  if (!left || !right || left.length !== right.length) {
    return DEFAULT_PHASH_BITS;
  }

  if (/^[0-9a-f]+$/i.test(left) && /^[0-9a-f]+$/i.test(right)) {
    return countSetBits(BigInt(`0x${left}`) ^ BigInt(`0x${right}`));
  }

  let distance = 0;
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) distance += 1;
  }

  return distance;
}

function phashSimilarity(hash1, hash2) {
  const bits = normalizeHash(hash1).length * 4 || DEFAULT_PHASH_BITS;
  const distance = hammingDistance(hash1, hash2);
  return clampPercentage((1 - distance / bits) * 100);
}

function bestCrossHashSimilarity(leftHashes = [], rightHashes = []) {
  let best = 0;

  for (const leftHash of leftHashes.filter(Boolean)) {
    for (const rightHash of rightHashes.filter(Boolean)) {
      if (normalizeHash(leftHash).length !== normalizeHash(rightHash).length) continue;
      best = Math.max(best, phashSimilarity(leftHash, rightHash));
    }
  }

  return best;
}

function fingerprintSimilarity(left = {}, right = {}) {
  const signals = [];
  const scores = [];

  if (left.pixelSha256 && right.pixelSha256 && left.pixelSha256 === right.pixelSha256) {
    signals.push("normalized_pixel_exact");
    scores.push(100);
  }

  for (const key of ["phash", "dhash", "whash", "averageHash"]) {
    if (left[key] && right[key]) {
      const score = phashSimilarity(left[key], right[key]);
      scores.push(score);

      if (score >= similarityThreshold()) {
        signals.push(key);
      }
    }
  }

  if (left.colorHash && right.colorHash) {
    const colorScore = phashSimilarity(left.colorHash, right.colorHash);
    scores.push(colorScore * 0.9);

    if (colorScore >= 92) {
      signals.push("colorHash");
    }
  }

  const leftRegions = [left.phash, ...(left.regionPhashes || [])];
  const rightRegions = [right.phash, ...(right.regionPhashes || [])];
  const regionScore = bestCrossHashSimilarity(leftRegions, rightRegions);

  if (regionScore) {
    scores.push(regionScore);

    if (regionScore >= regionSimilarityThreshold()) {
      signals.push("region_crop");
    }
  }

  return {
    score: scores.length ? Math.max(...scores) : 0,
    signals
  };
}

function similarityThreshold() {
  const configured = Number(process.env.IMAGE_REUSE_THRESHOLD);
  return Number.isFinite(configured) ? clampPercentage(configured) : DEFAULT_SIMILARITY_THRESHOLD;
}

function regionSimilarityThreshold() {
  const configured = Number(process.env.IMAGE_REGION_REUSE_THRESHOLD);
  return Number.isFinite(configured) ? clampPercentage(configured) : DEFAULT_REGION_SIMILARITY_THRESHOLD;
}

function fileToDataUrl(file) {
  const mimeType = file.mimetype || "application/octet-stream";
  return `data:${mimeType};base64,${file.data.toString("base64")}`;
}

function normalizePayload(payload) {
  if (!payload) return {};
  if (typeof payload === "object") return payload;

  if (typeof payload === "string") {
    try {
      const parsed = JSON.parse(payload);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  return {};
}

function isRenderableImageUrl(value) {
  return typeof value === "string" && /^(https?:\/\/|data:image\/)/i.test(value);
}

function resolveImageInput(req) {
  if (req.files?.image) {
    const imageFile = Array.isArray(req.files.image) ? req.files.image[0] : req.files.image;

    if (!imageFile.mimetype?.startsWith("image/")) {
      const err = new Error("Uploaded file must be an image");
      err.statusCode = 400;
      throw err;
    }

    return {
      imageInput: fileToDataUrl(imageFile),
      imageUrl: imageFile.name || "uploaded-image"
    };
  }

  const imageUrl = req.body?.imageUrl || req.body?.url;

  if (!imageUrl || typeof imageUrl !== "string") {
    const err = new Error("No image URL or uploaded image provided");
    err.statusCode = 400;
    throw err;
  }

  if (!/^(https?:\/\/|data:image\/)/i.test(imageUrl)) {
    const err = new Error("Image input must be an http(s) URL, data URL, or uploaded image");
    err.statusCode = 400;
    throw err;
  }

  return { imageInput: imageUrl, imageUrl };
}

async function callImageService(imageInput, payload) {
  const flaskUrl = process.env.IMAGE_SERVICE_URL || "http://127.0.0.1:6000/";

  const pythonRes = await axios.post(
    flaskUrl,
    { url: imageInput, payload },
    { timeout: 60000 }
  );

  const { image, sha256, phash, fingerprints = {}, processedAt } = pythonRes.data || {};
  const normalizedSha256 = normalizeHash(sha256);
  const normalizedPhash = normalizeHash(phash || fingerprints.phash);

  if (!/^[0-9a-f]{64}$/.test(normalizedSha256) || !/^[0-9a-f]+$/.test(normalizedPhash)) {
    const err = new Error("Invalid response from image service");
    err.statusCode = 502;
    throw err;
  }

  return {
    watermarkedImage: image,
    sha256: normalizedSha256,
    phash: normalizedPhash,
    fingerprints: {
      ...fingerprints,
      phash: normalizeHash(fingerprints.phash || normalizedPhash),
      dhash: normalizeHash(fingerprints.dhash),
      whash: normalizeHash(fingerprints.whash),
      averageHash: normalizeHash(fingerprints.averageHash),
      colorHash: normalizeHash(fingerprints.colorHash),
      pixelSha256: normalizeHash(fingerprints.pixelSha256),
      regionPhashes: Array.isArray(fingerprints.regionPhashes)
        ? fingerprints.regionPhashes.map(normalizeHash).filter(Boolean)
        : []
    },
    processedAt
  };
}

async function findBestMatch({ sha256, phash, fingerprints }) {
  const exactMatch = await Image.findOne({ sha256 });

  if (exactMatch) {
    return {
      reused: true,
      bestMatch: exactMatch,
      bestPercentage: 100,
      matchType: "exact",
      signals: ["sha256_exact"]
    };
  }

  if (fingerprints?.pixelSha256) {
    const pixelMatch = await Image.findOne({ "fingerprints.pixelSha256": fingerprints.pixelSha256 });

    if (pixelMatch) {
      return {
        reused: true,
        bestMatch: pixelMatch,
        bestPercentage: 100,
        matchType: "normalized_pixel_exact",
        signals: ["normalized_pixel_exact"]
      };
    }
  }

  const existingImages = await Image.find({
    $or: [
      { phash: { $exists: true, $ne: "" } },
      { "fingerprints.phash": { $exists: true, $ne: "" } },
      { "fingerprints.regionPhashes": { $exists: true, $ne: [] } }
    ]
  });
  let bestMatch = null;
  let bestPercentage = 0;
  let bestSignals = [];
  let bestMatchType = "none";

  for (const img of existingImages) {
    const existingFingerprints = {
      ...(img.fingerprints?.toObject?.() || img.fingerprints || {}),
      phash: img.fingerprints?.phash || img.phash
    };
    const { score, signals } = fingerprintSimilarity(
      { ...fingerprints, phash: fingerprints?.phash || phash },
      existingFingerprints
    );

    if (score > bestPercentage) {
      bestPercentage = score;
      bestMatch = img;
      bestSignals = signals;
      bestMatchType = signals.includes("region_crop") ? "region_crop" : "perceptual";
    }
  }

  return {
    reused: Boolean(
      bestMatch &&
      (bestPercentage >= similarityThreshold() || bestSignals.includes("region_crop"))
    ),
    bestMatch,
    bestPercentage,
    matchType: bestMatch ? bestMatchType : "none",
    signals: bestSignals
  };
}

async function persistImageAnalysis({
  imageUrl,
  sha256,
  phash,
  fingerprints,
  sourceId,
  match,
  processed   // ✅ REQUIRED
}) {
  // If exact match → don't insert duplicate
  if (match.matchType === "exact" && match.bestMatch) {
    return match.bestMatch;
  }

  try {
    return await Image.create({
      url: imageUrl,

      // ✅ store base64 image
      image: processed?.watermarkedImage || null,

      sha256,
      phash,
      fingerprints,
      sourceId,

      reused: match.reused,
      similarityPercentage: match.bestPercentage,

      matchedWith: match.bestMatch?.url || null,
      matchedWithId: match.bestMatch?._id || null,

      firstAppeared: new Date()
    });
  } catch (err) {
    if (err.code === 11000) {
      return await Image.findOne({ sha256 });
    }
    throw err;
  }
}
async function updateArticleImage({ articleId, sha256, phash, fingerprints, match }) {
  if (!articleId) return null;

  return Article.findByIdAndUpdate(
    articleId,
    {
      $set: {
        image: {
          reused: match.reused,
          similarityPercentage: clampPercentage(match.bestPercentage),
          matchedWith: match.bestMatch?.url || null,
          sha256,
          phash,
          matchType: match.matchType,
          matchSignals: match.signals || [],
          fingerprints,
          analyzedAt: new Date()
        }
      }
    },
    { new: true }
  );
}

async function handleImageTrust(req, res) {
  try {
    const { sourceId, articleId } = req.body || {};
    const payload = normalizePayload(req.body?.payload);
    const { imageInput, imageUrl } = resolveImageInput(req);
    const servicePayload = { ...payload, sourceId: sourceId || payload.sourceId || "unknown" };
    const processed = await callImageService(imageInput, servicePayload);
    const match = await findBestMatch(processed);
    await persistImageAnalysis({ imageUrl, sourceId, ...processed, match, processed });
    const article = await updateArticleImage({ articleId, ...processed, match });

    const info = {
      sha256: processed.sha256,
      phash: processed.phash,
      reused: match.reused,
      similarityPercentage: Number(clampPercentage(match.bestPercentage).toFixed(2)),
      matchedWith: match.bestMatch?.url || null,
      matchedImageId: match.bestMatch?._id || null,
      matchType: match.matchType,
      matchSignals: match.signals || [],
      sourceId: servicePayload.sourceId,
      threshold: similarityThreshold(),
      regionThreshold: regionSimilarityThreshold(),
      processedAt: processed.processedAt || new Date().toISOString()
    };

    return res.json({
      reused: info.reused,
      similarityPercentage: info.similarityPercentage,
      matchedWith: info.matchedWith,
      articleId: article?._id || articleId || null,
      info,
      watermarkedImage: processed.watermarkedImage,
      matchedImage: match.bestMatch?.image || (isRenderableImageUrl(match.bestMatch?.url) ? match.bestMatch.url : null)

    });
  } catch (err) {
    console.error("Error in image route:", err);
    const statusCode = err.statusCode || err.response?.status || 500;
    const message = err.response?.data?.error || err.response?.data || err.message || String(err);
    return res.status(statusCode).json({ error: message });
  }
}

router.post("/", handleImageTrust);
router.post("/upload", handleImageTrust);

module.exports = router;
