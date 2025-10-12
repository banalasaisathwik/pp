const { computeMessageScore } = require('../detectors/messageBased');
const { computeFactScore } = require('../detectors/factBased');
const { computeContextScore } = require('../detectors/contextBased');
const Article = require('../models/Article');
const Author = require('../models/Author');

async function calculateAndUpdateScores({ url, title, text, source, authorEmail }) {
  // Find or create author
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

  // Ensure author fields are initialized
  author.trustScore = typeof author.trustScore === 'number' ? author.trustScore : 0.5;
  author.totalArticles = typeof author.totalArticles === 'number' ? author.totalArticles : 0;
  author.fakeArticles = typeof author.fakeArticles === 'number' ? author.fakeArticles : 0;

  // Run detectors in parallel
  const [M, F, C] = await Promise.all([
    computeMessageScore(text),
    computeFactScore(text),
    computeContextScore(url, title, text)
  ]);

  const alpha = parseFloat(process.env.ALPHA || 0.4);
  const beta = parseFloat(process.env.BETA || 0.4);
  const f_i = alpha * M + beta * F + (1 - alpha - beta) * C;

  // Store article
  const a = new Article({
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
  await a.save();

  // Update author trust
  author.totalArticles += 1;
  if (f_i >= 0.7) {
    author.trustScore = Math.min(author.trustScore + 0.05, 1);
  } else if (f_i < 0.3) {
    author.fakeArticles += 1;
    author.trustScore = Math.max(author.trustScore - 0.1, 0);
  }
  await author.save();

  return {
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
}

module.exports = { calculateAndUpdateScores };