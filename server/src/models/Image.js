const mongoose = require("mongoose");

const ImageSchema = new mongoose.Schema({
  url: { type: String, required: true },
  sha256: { type: String, required: true },
  phash: { type: String, required: true },
  firstAppeared: { type: Date, default: Date.now },
  reused: { type: Boolean, default: false },
  similarityPercentage: { type: Number },
  matchedWith: { type: String },
  sourceId: { type: String }
});

module.exports = mongoose.model("Image", ImageSchema);
