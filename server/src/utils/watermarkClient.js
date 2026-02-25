const sharp = require("sharp");

async function embedWatermark(buffer, payload) {
  const metadata = JSON.stringify(payload);
  return sharp(buffer).withMetadata({ exif: { IFD0: { UserComment: metadata } } }).toBuffer();
}

async function extractWatermark(buffer) {
  const metadata = await sharp(buffer).metadata();
  if (metadata.exif && metadata.exif.IFD0 && metadata.exif.IFD0.UserComment) {
    return JSON.parse(metadata.exif.IFD0.UserComment);
  }
  throw new Error("No watermark found");
}

module.exports = { embedWatermark, extractWatermark };
