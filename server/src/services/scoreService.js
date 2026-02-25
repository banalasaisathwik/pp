const { computeMessageScore } = require('../detectors/messageBased');
const { computeFactScore } = require('../detectors/factBased');
const { computeContextScore } = require('../detectors/contextBased');
const Article = require('../models/Article');
const Author = require('../models/Author');
const axios = require('axios'); // for external ML API calls

async function calculateAndUpdateScores({ url, title, text, source, authorEmail }) {
  try {
    const existingArticle = await Article.findOne({ url });

    if (existingArticle) {
      const author = await Author.findById(existingArticle.author);
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
          fakeArticles: author?.fakeArticles ?? 0
        }
      };
    }

    let author = await Author.findOne({ email: authorEmail });
    if (!author) {
      author = new Author({
        name: source || 'Unknown',
        email: authorEmail,
        trustScore: 0.5,
        totalArticles: 0,
        fakeArticles: 0
      });
      await author.save();
    }

    let M, F, C;
    try {
      const mlResponse = await axios.post(process.env.ML_API_URL, {
        url,
        title,
        text,
        source,
        authorEmail
      });
      ({ M, F, C } = mlResponse.data);
    } catch (mlErr) {
      console.error('ML API failed, falling back to local detectors');
      [M, F, C] = await Promise.all([
        computeMessageScore(text),
        computeFactScore(text),
        computeContextScore(url, title, text)
      ]);
    }

    const alpha = parseFloat(process.env.ALPHA || 0.4);
    const beta = parseFloat(process.env.BETA || 0.4);
    const f_i = alpha * M + beta * F + (1 - alpha - beta) * C;

    const newArticle = new Article({
      url,
      source,
      title,
      text,
      M,
      F,
      C,
      f: f_i,
      author: author._id,
      createdAt: new Date()
    });
    await newArticle.save();

    author.totalArticles += 1;
    if (f_i >= 0.7) {
      author.trustScore = Math.min(author.trustScore + 0.05, 1);
    } else if (f_i < 0.3) {
      author.fakeArticles += 1;
      author.trustScore = Math.max(author.trustScore - 0.1, 0);
    }
    await author.save();

    return {
      fromCache: false,
      M,
      F,
      C,
      f: f_i,
      author: {
        name: author.name,
        email: author.email,
        trustScore: author.trustScore,
        totalArticles: author.totalArticles,
        fakeArticles: author.fakeArticles
      }
    };
  } catch (err) {
    console.error('Error calculating trust score:', err);
    return { error: err.message };
  }
}

module.exports = { calculateAndUpdateScores };
