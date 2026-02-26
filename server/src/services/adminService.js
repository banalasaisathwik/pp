const { calculateAndUpdateScores } = require('./scoreService');
const articleRepository = require('../repositories/articleRepository');
const auditLogRepository = require('../repositories/auditLogRepository');
const { recalculateAuthorTrustByAuthorId, recalculateAuthorTrustByEmail } = require('./authorTrustService');
const { getMetricsSnapshot, increment } = require('../utils/metrics');
const { getMLCircuitStatus } = require('../clients/mlClient');
const { getImageWorkerCircuitStatus } = require('../clients/imageWorkerClient');
const { writeArticleVerification, sha256Hex } = require('./blockchainService');
const logger = require('../utils/logger');

async function publishArticleByAdmin({ actor, title, text, url, author }) {
  const result = await calculateAndUpdateScores({
    url,
    title,
    text,
    source: author.name,
    authorEmail: author.email,
  });

  await recalculateAuthorTrustByEmail(author.email);

  const article = await articleRepository.findByUrl(url);

  let blockchainMeta = {
    blockchainHash: sha256Hex(text),
    blockchainStatus: 'pending',
  };

  try {
    blockchainMeta = await writeArticleVerification({
      text,
      trustScore: result.f,
    });
  } catch (err) {
    increment('blockchainFailureCount');
    logger.error('blockchain_write_failed', {
      actor,
      articleUrl: url,
      message: err.message,
    });
  }

  if (article) {
    article.blockchainHash = blockchainMeta.blockchainHash;
    article.blockchainTxHash = blockchainMeta.blockchainTxHash;
    article.blockchainStatus = blockchainMeta.blockchainStatus;
    article.blockchainTimestamp = blockchainMeta.blockchainTimestamp;
    await articleRepository.save(article);
  }

  await auditLogRepository.create({
    actor,
    action: 'admin.article.publish',
    entityId: url,
    metadata: {
      title,
      authorEmail: author.email,
      fromCache: result.fromCache,
      blockchainTxHash: blockchainMeta.blockchainTxHash || null,
      blockchainStatus: blockchainMeta.blockchainStatus,
    },
  });

  return {
    ...result,
    blockchain: {
      txHash: blockchainMeta.blockchainTxHash || null,
      status: blockchainMeta.blockchainStatus,
      timestamp: blockchainMeta.blockchainTimestamp || null,
      hash: blockchainMeta.blockchainHash,
    },
  };
}

async function overrideArticleTrust({ actor, articleId, newTrustScore, reason }) {
  const article = await articleRepository.findById(articleId);
  if (!article) {
    throw new Error('Article not found');
  }

  const previousTrustScore = article.f;
  article.f = newTrustScore;
  article.trustOverridden = true;
  article.overrideReason = reason;
  article.overrideBy = actor;
  article.overrideAt = new Date();
  article.originalF = previousTrustScore;
  await articleRepository.save(article);

  const updatedAuthor = await recalculateAuthorTrustByAuthorId(article.author);

  await auditLogRepository.create({
    actor,
    action: 'admin.article.trust_override',
    entityId: String(article._id),
    metadata: {
      reason,
      previousTrustScore,
      newTrustScore,
      authorId: String(article.author),
      blockchainTxHash: article.blockchainTxHash || null,
    },
  });

  return {
    articleId: String(article._id),
    previousTrustScore,
    newTrustScore,
    author: {
      id: String(updatedAuthor._id),
      email: updatedAuthor.email,
      trustScore: updatedAuthor.trustScore,
      totalArticles: updatedAuthor.totalArticles,
      fakeArticles: updatedAuthor.fakeArticles,
    },
  };
}

async function getAdminDashboard() {
  const totalArticles = await articleRepository.countAll();
  const averageTrustScore = await articleRepository.averageTrustScore();
  const metrics = getMetricsSnapshot();

  return {
    totalArticles,
    averageTrustScore,
    mlFailureCount: metrics.mlFailureCount,
    fallbackUsageCount: metrics.fallbackUsageCount,
    blockchainFailureCount: metrics.blockchainFailureCount,
    circuitBreakerStatus: {
      mlClient: getMLCircuitStatus(),
      imageWorkerClient: getImageWorkerCircuitStatus(),
    },
  };
}

module.exports = {
  publishArticleByAdmin,
  overrideArticleTrust,
  getAdminDashboard,
};
