const express = require('express');

const { analyzeAndUpsertImage } = require('../services/imageTrustService');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');

const router = express.Router();

router.post('/', async (req, res) => {
  const { imageUrl, sourceId, payload } = req.body;
  if (!imageUrl) {
    return sendError(res, 'No image URL provided', 400);
  }

  try {
    const result = await analyzeAndUpsertImage({ imageUrl, sourceId, payload });
    return sendSuccess(res, result);
  } catch (err) {
    logger.error('image_analysis_failed', {
      requestId: req.requestId,
      message: err.message,
    });
    if (String(err.message || '').startsWith('CircuitOpen:')) {
      return sendError(res, err.message, 503);
    }

    const message = err?.response?.data || err.message || String(err);
    return sendError(res, String(message), 500);
  }
});

module.exports = router;
