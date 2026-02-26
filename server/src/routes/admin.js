const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');
const {
  publishArticleByAdmin,
  overrideArticleTrust,
  getAdminDashboard,
} = require('../services/adminService');

const router = express.Router();

router.use(requireAuth, requireAdmin);

router.post('/articles', async (req, res) => {
  const { title, text, url, author } = req.body;

  if (!title || !text || !url || !author?.email || !author?.name) {
    return sendError(res, 'title, text, url, author.name, author.email are required', 400);
  }

  try {
    const result = await publishArticleByAdmin({
      actor: req.user.sub,
      title,
      text,
      url,
      author,
    });
    return sendSuccess(res, result, 201);
  } catch (err) {
    logger.error('admin_publish_article_failed', {
      requestId: req.requestId,
      actor: req.user?.sub,
      message: err.message,
    });
    return sendError(res, err.message || 'Failed to publish article', 500);
  }
});

router.post('/articles/:id/trust-override', async (req, res) => {
  const { id } = req.params;
  const { trustScore, reason } = req.body;

  if (typeof trustScore !== 'number' || trustScore < 0 || trustScore > 1) {
    return sendError(res, 'trustScore must be a number between 0 and 1', 400);
  }

  if (!reason) {
    return sendError(res, 'override reason is required', 400);
  }

  try {
    const result = await overrideArticleTrust({
      actor: req.user.sub,
      articleId: id,
      newTrustScore: trustScore,
      reason,
    });
    return sendSuccess(res, result);
  } catch (err) {
    logger.error('admin_override_trust_failed', {
      requestId: req.requestId,
      actor: req.user?.sub,
      message: err.message,
    });
    return sendError(res, err.message || 'Failed to override trust score', 500);
  }
});

router.get('/dashboard', async (req, res) => {
  try {
    const dashboard = await getAdminDashboard();
    return sendSuccess(res, dashboard);
  } catch (err) {
    logger.error('admin_dashboard_failed', {
      requestId: req.requestId,
      actor: req.user?.sub,
      message: err.message,
    });
    return sendError(res, 'Failed to load dashboard', 500);
  }
});

module.exports = router;
