const mongoose = require("mongoose");

const ImageSchema = new mongoose.Schema({
  url: { type: String, required: true },
  image: { type: String },
  sha256: { type: String, required: true, unique: true },
  phash: { type: String, required: true, index: true },
  fingerprints: {
    pixelSha256: { type: String, index: true },
    phash: String,
    dhash: String,
    whash: String,
    averageHash: String,
    colorHash: String,
    regionPhashes: [String],
    width: Number,
    height: Number
  },
  firstAppeared: { type: Date, default: Date.now },
  reused: { type: Boolean, default: false },
  similarityPercentage: { type: Number, default: 0 },
  matchedWith: { type: String },
  matchedWithId: { type: mongoose.Schema.Types.ObjectId, ref: "Image" },
  sourceId: { type: String }
});

module.exports = mongoose.model("Image", ImageSchema);
