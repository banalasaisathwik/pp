const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const AuthorSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  trustScore: { type: Number, default: 0.5 }, // between 0 and 1
  totalArticles: { type: Number, default: 0 },
  fakeArticles: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Author', AuthorSchema);
