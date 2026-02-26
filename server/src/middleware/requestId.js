const crypto = require('crypto');
const logger = require('../utils/logger');

function requestIdMiddleware(req, res, next) {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);

  const start = Date.now();
  logger.info('request_started', {
    requestId,
    method: req.method,
    path: req.path,
  });

  res.on('finish', () => {
    logger.info('request_finished', {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Date.now() - start,
    });
  });

  next();
}

module.exports = { requestIdMiddleware };
