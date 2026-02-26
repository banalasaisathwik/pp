const crypto = require('crypto');
const { storeArticleOnChain } = require('../clients/blockchainClient');

function sha256Hex(text) {
  return crypto.createHash('sha256').update(text || '', 'utf8').digest('hex');
}

function toBytes32(hex) {
  return `0x${hex}`;
}

function scaleTrustScore(score) {
  return BigInt(Math.round(Number(score) * 1000000));
}

async function writeArticleVerification({ text, trustScore }) {
  const hashHex = sha256Hex(text);
  const articleHash = toBytes32(hashHex);
  const trustScoreScaled = scaleTrustScore(trustScore);

  const chainResult = await storeArticleOnChain({ articleHash, trustScoreScaled });

  return {
    blockchainHash: hashHex,
    blockchainTxHash: chainResult.txHash,
    blockchainTimestamp: chainResult.blockchainTimestamp,
    blockchainStatus: 'success',
  };
}

module.exports = {
  sha256Hex,
  writeArticleVerification,
};
