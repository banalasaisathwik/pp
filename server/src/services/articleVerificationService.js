const articleRepository = require('../repositories/articleRepository');
const { sha256Hex } = require('./blockchainService');

async function verifyArticleById(articleId) {
  const article = await articleRepository.findById(articleId);
  if (!article) {
    throw new Error('Article not found');
  }

  const computedHash = sha256Hex(article.text || '');
  const verified = Boolean(article.blockchainHash) && computedHash === article.blockchainHash;

  return {
    verified,
    txHash: article.blockchainTxHash || null,
    blockchainTimestamp: article.blockchainTimestamp || null,
    blockchainStatus: article.blockchainStatus || 'pending',
  };
}

module.exports = { verifyArticleById };
