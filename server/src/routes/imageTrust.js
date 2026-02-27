const express = require('express');
const router = express.Router();
const axios = require('axios');
const Image = require('../models/Image');
const Article = require("../models/Article");

function hammingDistance(hash1, hash2) {
  if (!hash1 || !hash2 || hash1.length !== hash2.length) {
    return 64;
  }

  let dist = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) dist++;
  }
  return dist;
}

router.post("/", async (req, res) => {
  const { imageUrl, sourceId, payload, articleId } = req.body;

  if (!imageUrl) {
    return res.status(400).json({ error: "No image URL provided" });
  }

  try {
    const flaskUrl = "http://127.0.0.1:6000/";

    const pythonRes = await axios.post(
      flaskUrl,
      { url: imageUrl, payload: payload || { sourceId } },
      { timeout: 60000 }
    );

    const { image: wmImageHex, sha256, phash } = pythonRes.data || {};

    if (!sha256 || !phash) {
      return res.status(500).json({ error: "Invalid response from image service" });
    }

    // 1️⃣ Exact match
    const exactMatch = await Image.findOne({ sha256 });

    let reused = false;
    let bestMatch = null;
    let bestPercentage = 0;

    if (exactMatch) {
      reused = true;
      bestMatch = exactMatch;
      bestPercentage = 100;
    } else {
      // 2️⃣ Perceptual similarity
      const existingImages = await Image.find();

      for (const img of existingImages) {
        if (!img.phash) continue;

        const distance = hammingDistance(phash, img.phash);
        const similarity = 1 - (distance / 64);
        const percentage = similarity * 100;

        if (percentage > bestPercentage) {
          bestPercentage = percentage;
          bestMatch = img;
        }
      }

      if (bestPercentage >= 85 && bestMatch) {
        reused = true;
      }

      // Save new image record
      await Image.create({
        url: imageUrl,
        sha256,
        phash,
        sourceId,
        reused,
        similarityPercentage: bestPercentage,
        matchedWith: bestMatch ? bestMatch.url : null,
        firstAppeared: new Date()
      });
    }

    // 🔥 NOW update Article (AFTER similarity computed)
    if (articleId) {
      await Article.findByIdAndUpdate(articleId, {
        $set: {
          image: {
            reused,
            similarityPercentage: bestPercentage,
            matchedWith: bestMatch ? bestMatch.url : null,
            sha256,
            phash
          }
        }
      });
    }

    return res.json({
      info: {
        sha256,
        phash,
        reused,
        similarityPercentage: bestPercentage.toFixed(2),
        matchedWith: bestMatch ? bestMatch.url : null
      },
      watermarkedImage: wmImageHex
    });

  } catch (err) {
    console.error("Error in image route:", err);
    const message = err?.response?.data || err.message || String(err);
    return res.status(500).json({ error: message });
  }
});

module.exports = router;