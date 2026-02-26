const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const scoreField = { type: Number, min: 0, max: 1 };

const ArticleSchema = new Schema({
  url: { type: String },
  source: String,
  title: String,
  text: String,
  M: scoreField,
  F: scoreField,
  C: scoreField,
  f: scoreField,
  trustOverridden: { type: Boolean, default: false },
  overrideReason: { type: String },
  overrideBy: { type: String },
  overrideAt: { type: Date },
  originalF: scoreField,
  blockchainHash: { type: String },
  blockchainTxHash: { type: String },
  blockchainStatus: { type: String, enum: ['success', 'pending', 'failed'], default: 'pending' },
  blockchainTimestamp: { type: Date },
  createdAt: { type: Date, default: Date.now },
  author: { type: Schema.Types.ObjectId, ref: 'Author', required: true },
});

ArticleSchema.index(
  { url: 1 },
  { unique: true, partialFilterExpression: { url: { $type: 'string', $ne: '' } } }
);
ArticleSchema.index({ blockchainHash: 1 });

module.exports = mongoose.model('Article', ArticleSchema);
