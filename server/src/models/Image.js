const mongoose = require('mongoose');

const ImageSchema = new mongoose.Schema({
  url: { type: String, required: true },
  sha256: { type: String, required: true },
  firstAppeared: { type: Date, default: Date.now },
  reused: { type: Boolean, default: false },
  sourceId: { type: String },
});

ImageSchema.index({ sha256: 1 }, { unique: true });

module.exports = mongoose.model('Image', ImageSchema);
