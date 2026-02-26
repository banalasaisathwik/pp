const { analyzeImageWithWorker } = require('../clients/imageWorkerClient');
const imageRepository = require('../repositories/imageRepository');

async function analyzeAndUpsertImage({ imageUrl, sourceId, payload }) {
  const workerData = await analyzeImageWithWorker({ imageUrl, sourceId, payload });
  const { image: wmImageHex, sha256, firstAppeared, reused } = workerData;

  let imageDoc = await imageRepository.findBySha256(sha256);
  if (!imageDoc) {
    imageDoc = await imageRepository.create({
      url: imageUrl,
      sha256,
      sourceId,
      reused,
      firstAppeared: firstAppeared ? new Date(firstAppeared) : undefined,
    });
  }

  return {
    info: {
      sha256: imageDoc.sha256,
      firstAppeared: imageDoc.firstAppeared,
      reused: imageDoc.reused,
      sourceId: imageDoc.sourceId,
    },
    watermarkedImage: wmImageHex,
  };
}

module.exports = { analyzeAndUpsertImage };
