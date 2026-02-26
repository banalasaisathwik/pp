const authorRepository = require('../repositories/authorRepository');
const articleRepository = require('../repositories/articleRepository');
const { applyAuthorTrustUpdate } = require('../domain/trustPolicy');

async function recalculateAuthorTrustByAuthorId(authorId) {
  const author = await authorRepository.findById(authorId);
  if (!author) {
    throw new Error('Author not found');
  }

  const articles = await articleRepository.findByAuthorId(authorId);

  author.trustScore = 0.5;
  author.totalArticles = 0;
  author.fakeArticles = 0;

  for (const article of articles) {
    applyAuthorTrustUpdate(author, article.f);
  }

  await authorRepository.save(author);
  return author;
}

async function recalculateAuthorTrustByEmail(email) {
  const author = await authorRepository.findByEmail(email);
  if (!author) {
    throw new Error('Author not found');
  }
  return recalculateAuthorTrustByAuthorId(author._id);
}

module.exports = {
  recalculateAuthorTrustByAuthorId,
  recalculateAuthorTrustByEmail,
};
