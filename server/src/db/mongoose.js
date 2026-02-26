const mongoose = require('mongoose');
const logger = require('../utils/logger');

module.exports = async function connectDB() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/fake_trust';
  await mongoose.connect(uri);
  logger.info('mongodb_connected', { uri });
};
