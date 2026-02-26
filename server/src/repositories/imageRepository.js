const Image = require('../models/Image');

async function findBySha256(sha256) {
  return Image.findOne({ sha256 });
}

async function create(data) {
  const image = new Image(data);
  return image.save();
}

module.exports = { findBySha256, create };
