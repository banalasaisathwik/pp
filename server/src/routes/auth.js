const express = require('express');
const { sendSuccess, sendError } = require('../utils/response');
const { adminLogin } = require('../services/authService');
const logger = require('../utils/logger');

const router = express.Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return sendError(res, 'username and password required', 400);
  }

  try {
    const result = adminLogin({ username, password });
    return sendSuccess(res, result);
  } catch (err) {
    logger.warn('admin_login_failed', { requestId: req.requestId, message: err.message });
    return sendError(res, 'Invalid credentials', 401);
  }
});

module.exports = router;
