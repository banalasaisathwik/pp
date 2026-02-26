const AuditLog = require('../models/AuditLog');

async function create(data) {
  const log = new AuditLog(data);
  return log.save();
}

module.exports = { create };
