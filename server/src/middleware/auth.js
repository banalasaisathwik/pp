const { verify } = require('../utils/jwt');
const { sendError } = require('../utils/response');

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return sendError(res, 'Unauthorized', 401);
  }

  try {
    const payload = verify(token, process.env.JWT_SECRET || 'dev-secret');
    req.user = payload;
    return next();
  } catch (err) {
    return sendError(res, 'Invalid token', 401);
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return sendError(res, 'Forbidden', 403);
  }
  return next();
}

module.exports = { requireAuth, requireAdmin };
