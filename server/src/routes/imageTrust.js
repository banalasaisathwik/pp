const express = require('express');
const router = express.Router();
const axios = require('axios');
const Image = require('../models/Image');

router.post("/", async (req, res) => {
  const { imageUrl, sourceId, payload } = req.body;
  if (!imageUrl) return res.status(400).json({ error: "No image URL provided" });

  try {
    const flaskUrl = "http://127.0.0.1:6000/";

    let pythonRes;
    try {
      pythonRes = await axios.post(
        flaskUrl,
        { url: imageUrl, payload: payload || { sourceId } },
        { timeout: 60000 }
      );
    } catch (firstErr) {
      console.warn("First Flask request failed, retrying once...", firstErr.message);
      try {
        pythonRes = await axios.post(
          flaskUrl,
          { url: imageUrl, payload: payload || { sourceId } },
          {
            timeout: 60000,
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
          }
        );
      } catch (secondErr) {
        console.error("Both Flask requests failed:", firstErr.message, secondErr.message);
        if (secondErr.code === 'ECONNREFUSED') {
          return res.status(502).json({ error: `Image worker (Flask) unavailable at ${flaskUrl}` });
        }
        throw secondErr;
      }
    }

    const { image: wmImageHex, sha256, firstAppeared, reused } = pythonRes.data || {};

    let imageDoc = await Image.findOne({ sha256 });
    if (!imageDoc) {
      imageDoc = await Image.create({
        url: imageUrl,
        sha256,
        sourceId,
        reused,
        firstAppeared: firstAppeared ? new Date(firstAppeared) : undefined,
      });
    }

    return res.json({
      info: {
        sha256: imageDoc.sha256,
        firstAppeared: imageDoc.firstAppeared,
        reused: imageDoc.reused,
        sourceId: imageDoc.sourceId,
      },
      watermarkedImage: wmImageHex,
    });
  } catch (err) {
    console.error("Error in image route:", err);
    const message = err?.response?.data || err.message || String(err);
    res.status(500).json({ error: message });
  }
});

module.exports = router;