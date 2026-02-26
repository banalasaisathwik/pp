function sendSuccess(res, data, status = 200) {
  return res.status(status).json({ success: true, data });
}

function sendError(res, error, status = 500) {
  return res.status(status).json({ success: false, error });
}

module.exports = { sendSuccess, sendError };
