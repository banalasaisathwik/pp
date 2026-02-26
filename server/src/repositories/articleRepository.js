const Article = require('../models/Article');

async function findByUrl(url, options = {}) {
  const query = Article.findOne({ url });
  if (options.session) query.session(options.session);
  return query;
}

async function findById(id, options = {}) {
  const query = Article.findById(id);
  if (options.session) query.session(options.session);
  return query;
}

async function findByAuthorId(authorId, options = {}) {
  const query = Article.find({ author: authorId }).sort({ createdAt: 1 });
  if (options.session) query.session(options.session);
  return query;
}

async function countAll() {
  return Article.countDocuments({});
}

async function averageTrustScore() {
  const result = await Article.aggregate([
    { $group: { _id: null, avgF: { $avg: '$f' } } },
  ]);
  return result[0]?.avgF ?? 0;
}

async function create(data, options = {}) {
  const article = new Article(data);
  return article.save(options.session ? { session: options.session } : undefined);
}

async function save(article, options = {}) {
  return article.save(options.session ? { session: options.session } : undefined);
}

module.exports = {
  findByUrl,
  findById,
  findByAuthorId,
  countAll,
  averageTrustScore,
  create,
  save,
};
