const express = require('express');
const { sendSuccess, sendError } = require('../utils/response');
const { verifyArticleById } = require('../services/articleVerificationService');
const logger = require('../utils/logger');

const router = express.Router();

router.get('/:id/verify', async (req, res) => {
  try {
    const result = await verifyArticleById(req.params.id);
    return sendSuccess(res, result);
  } catch (err) {
    logger.error('article_verify_failed', {
      requestId: req.requestId,
      articleId: req.params.id,
      message: err.message,
    });
    if (err.message === 'Article not found') {
      return sendError(res, err.message, 404);
    }
    return sendError(res, 'Failed to verify article', 500);
  }
});

module.exports = router;
