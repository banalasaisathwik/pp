const mongoose = require('mongoose');
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
  author: { type: Schema.Types.ObjectId, ref: 'Author', required: true }
});

module.exports = mongoose.model('Article', ArticleSchema);
