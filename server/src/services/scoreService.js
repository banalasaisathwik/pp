const mongoose = require('mongoose');
const { computeMessageScore } = require('../detectors/messageBased');
const { computeFactScore } = require('../detectors/factBased');
const { computeContextScore } = require('../detectors/contextBased');
const articleRepository = require('../repositories/articleRepository');
const authorRepository = require('../repositories/authorRepository');
const { getScoresFromML } = require('../clients/mlClient');
const {
  computeCompositeScore,
  applyAuthorTrustUpdate,
} = require('../domain/trustPolicy');
const logger = require('../utils/logger');
const metrics = require('../utils/metrics');

function supportsTransactions(connection) {
  return connection?.readyState === 1;
}

function isTransactionUnsupportedError(err) {
  const message = String(err?.message || '');
  return message.includes('Transaction numbers are only allowed')
    || message.includes('does not support retryable writes')
    || message.includes('replica set');
}

async function runWithOptionalTransaction(work) {
  if (!supportsTransactions(mongoose.connection)) {
    return work({});
  }

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work({ session });
    });
    return result;
  } catch (err) {
    if (!isTransactionUnsupportedError(err)) throw err;
    logger.warn('transaction_fallback_non_supported', { message: err.message });
    return work({});
  } finally {
    await session.endSession();
  }
}

async function calculateAndUpdateScores({ url, title, text, source, authorEmail }) {
  const existingArticle = await articleRepository.findByUrl(url);

  if (existingArticle) {
    const author = await authorRepository.findById(existingArticle.author);
    return {
      fromCache: true,
      M: existingArticle.M,
      F: existingArticle.F,
      C: existingArticle.C,
      f: existingArticle.f,
      author: {
        name: author?.name || source || 'Unknown',
        email: author?.email || authorEmail,
        trustScore: author?.trustScore ?? 0.5,
        totalArticles: author?.totalArticles ?? 0,
        fakeArticles: author?.fakeArticles ?? 0,
      },
    };
  }

  let M;
  let F;
  let C;
  try {
    const mlData = await getScoresFromML({ url, title, text, source, authorEmail });
    ({ M, F, C } = mlData);
  } catch (mlErr) {
    metrics.increment('mlFailureCount');
    metrics.increment('fallbackUsageCount');
    logger.warn('ml_fallback_to_local_detectors', { message: mlErr.message });
    [M, F, C] = await Promise.all([
      computeMessageScore(text),
      computeFactScore(text),
      computeContextScore(url, title, text),
    ]);
  }

  const alpha = parseFloat(process.env.ALPHA || 0.4);
  const beta = parseFloat(process.env.BETA || 0.4);
  const f = computeCompositeScore({ M, F, C, alpha, beta });

  const author = await runWithOptionalTransaction(async ({ session }) => {
    let currentAuthor = await authorRepository.findByEmail(authorEmail, { session });
    if (!currentAuthor) {
      currentAuthor = await authorRepository.create({
        name: source || 'Unknown',
        email: authorEmail,
        trustScore: 0.5,
        totalArticles: 0,
        fakeArticles: 0,
      }, { session });
    }

    await articleRepository.create({
      url,
      source,
      title,
      text,
      M,
      F,
      C,
      f,
      author: currentAuthor._id,
      createdAt: new Date(),
    }, { session });

    applyAuthorTrustUpdate(currentAuthor, f);
    await authorRepository.save(currentAuthor, { session });
    return currentAuthor;
  });

  return {
    fromCache: false,
    M,
    F,
    C,
    f,
    author: {
      name: author.name,
      email: author.email,
      trustScore: author.trustScore,
      totalArticles: author.totalArticles,
      fakeArticles: author.fakeArticles,
    },
  };
}

module.exports = { calculateAndUpdateScores };
