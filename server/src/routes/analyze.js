const express = require('express');
const router = express.Router();
const { calculateAndUpdateScores } = require('../services/scoreService');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');

router.post('/', async (req, res) => {
  const { url, title, text, source, authorEmail } = req.body;
  if (!text) return sendError(res, 'text required', 400);
  if (!authorEmail) return sendError(res, 'authorEmail required', 400);

  try {
    const result = await calculateAndUpdateScores({ url, title, text, source, authorEmail });
    return sendSuccess(res, result);
  } catch (err) {
    logger.error('analyze_failed', {
      requestId: req.requestId,
      message: err.message,
    });
    return sendError(res, 'internal error', 500);
  }
});

module.exports = router;
