const Author = require('../models/Author');

async function findByEmail(email, options = {}) {
  const query = Author.findOne({ email });
  if (options.session) query.session(options.session);
  return query;
}

async function findById(id, options = {}) {
  const query = Author.findById(id);
  if (options.session) query.session(options.session);
  return query;
}

async function create(data, options = {}) {
  const author = new Author(data);
  return author.save(options.session ? { session: options.session } : undefined);
}

async function save(author, options = {}) {
  return author.save(options.session ? { session: options.session } : undefined);
}

module.exports = { findByEmail, findById, create, save };
