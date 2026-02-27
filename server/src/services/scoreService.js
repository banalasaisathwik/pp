const { computeMessageScore } = require('../detectors/messageBased');
const { computeFactScore } = require('../detectors/factBased');
const { computeContextScore } = require('../detectors/contextBased');
const Article = require('../models/Article');
const Author = require('../models/Author');
const axios = require('axios');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { storeOnChain } = require("../../blockchain/blockchainService");

async function calculateAndUpdateScores({ url, title, text, source, authorEmail }) {

  if (!text || !authorEmail) {
    return { error: "text and authorEmail are required" };
  }

  const session = await mongoose.startSession();

  let textHash;
  let f_i;
  let author;

  try {
    session.startTransaction();

    // 🔐 Generate content hash
    textHash = crypto
      .createHash('sha256')
      .update(text)
      .digest('hex');

    // 🔎 Duplicate detection by textHash
    const existingArticle = await Article
      .findOne({ textHash })
      .populate('author');

    if (existingArticle) {
      await session.abortTransaction();
      session.endSession();

      return {
        fromCache: true,
        M: existingArticle.M,
        F: existingArticle.F,
        C: existingArticle.C,
        f: existingArticle.f,
        author: {
          name: existingArticle.author?.name || source || 'Unknown',
          email: existingArticle.author?.email || authorEmail,
          trustScore: existingArticle.author?.trustScore ?? 0.5,
          totalArticles: existingArticle.author?.totalArticles ?? 0,
          fakeArticles: existingArticle.author?.fakeArticles ?? 0
        }
      };
    }

    // 👤 Find or Create Author
    author = await Author.findOne({ email: authorEmail }).session(session);

    if (!author) {
      author = new Author({
        name: source || 'Unknown',
        email: authorEmail,
        trustScore: 0.5,
        totalArticles: 0,
        fakeArticles: 0
      });

      await author.save({ session });
    }

    // 📊 Compute Scores
let M, F, C;

try {
  if (!process.env.ML_API_URL) {
    throw new Error("ML API not configured");
  }

  const mlResponse = await axios.post(process.env.ML_API_URL, {
    title,
    text
  });

  const data = mlResponse.data;

  M = data.message_score;
  F = data.fact_score;
  C = data.context_score;

  console.log("✅ ML Scores:", { M, F, C });

} catch (mlErr) {
  console.warn("ML API failed. Using local detectors.");

  [M, F, C] = await Promise.all([
    computeMessageScore(text),
    computeFactScore(text),
    computeContextScore(url, title, text)
  ]);
}
    // 🧮 Final credibility score
    const alpha = parseFloat(process.env.ALPHA || 0.4);
    const beta = parseFloat(process.env.BETA || 0.4);

    f_i = alpha * M + beta * F + (1 - alpha - beta) * C;

    // 📄 Metadata
    const wordCount = text.split(/\s+/).length;
    const readingTime = Math.ceil(wordCount / 200);

    // 💾 Save Article
    const newArticle = new Article({
      url,
      source,
      title,
      text,
      textHash,
      metadata: {
        wordCount,
        readingTime
      },
      M,
      F,
      C,
      f: f_i,
      author: author._id,
      createdAt: new Date()
    });

    await newArticle.save({ session });

    // 📈 Bayesian Trust Update
    author.totalArticles += 1;

    if (f_i < 0.6) {
      author.fakeArticles += 1;
    }

    author.trustScore =
      (author.totalArticles - author.fakeArticles + 1) /
      (author.totalArticles + 2);

    await author.save({ session });

    // ✅ Commit DB transaction
    await session.commitTransaction();
    session.endSession();

  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error('Error calculating trust score:', err);
    return { error: err.message };
  }

  // 🔗 BLOCKCHAIN CALL (OUTSIDE DB TRANSACTION)
try {
  const zeroHash =
    "0x0000000000000000000000000000000000000000000000000000000000000000";

  const txHash = await storeOnChain(
    "0x" + textHash,
    zeroHash,
    f_i
  );

  // Update article with blockchain info
  await Article.updateOne(
    { textHash },
    {
      $set: {
        blockchain: {
          txHash,
          anchoredAt: new Date(),
          anchored: true
        }
      }
    }
  );

} catch (bcErr) {
  console.error("Blockchain failed but DB is safe:", bcErr.message);
}
  return {
    fromCache: false,
    f: f_i,
    author: {
      name: author.name,
      email: author.email,
      trustScore: author.trustScore,
      totalArticles: author.totalArticles,
      fakeArticles: author.fakeArticles
    }
  };
}

module.exports = { calculateAndUpdateScores };