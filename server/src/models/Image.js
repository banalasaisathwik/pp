const mongoose = require("mongoose");

const ImageSchema = new mongoose.Schema({
  url: { type: String, required: true },         // original image URL
  sha256: { type: String, required: true },      // SHA256 hash of the image
  firstAppeared: { type: Date, default: Date.now },
  reused: { type: Boolean, default: false },     // whether this image already existed
  sourceId: { type: String },                    // e.g., author's email or ID
});

module.exports = mongoose.model("Image", ImageSchema);
