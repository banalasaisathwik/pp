const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const ArticleSchema = new Schema({
  url: String,
  source: String,
  title: String,
  text: String,
  M: Number,
  F: Number,
  C: Number,
  f: Number,
  createdAt: { type: Date, default: Date.now },
  author: { type: Schema.Types.ObjectId, ref: "Author", required: true },
  textHash: { type: String, unique: true },
  metadata: {
    wordCount: Number,
    readingTime: Number,
  },
  blockchain: {
  txHash: { type: String },
  anchoredAt: { type: Date },
  anchored: { type: Boolean, default: false },
  image: {
  reused: Boolean,
  similarityPercentage: Number,
  matchedWith: String,
  sha256: String,
  phash: String
}
}
});

module.exports = mongoose.model("Article", ArticleSchema);
