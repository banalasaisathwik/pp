const express = require('express');
const router = express.Router();
const Author = require('../models/Author');
const Article = require('../models/Article');

router.post('/author', async (req, res) => {
  try {
    const { name, email } = req.body;

    let author = await Author.findOne({ email });
    if (author) {
      return res.status(400).json({ message: 'Author already exists', author });
    }

    author = new Author({ name, email });
    await author.save();

    res.status(201).json({ message: 'Author created successfully', author });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create author' });
  }
});


router.post('/article', async (req, res) => {
  try {
    const { url, source, title, text, M, F, C, authorEmail } = req.body;

    const f = 0.5 * M + 0.3 * F + 0.2 * C;

    let author = await Author.findOne({ email: authorEmail });
    if (!author) {
  author = new Author({ name: source || 'Unknown', email: authorEmail });
  await author.save();
    }

    const article = new Article({ url, source, title, text, M, F, C, f, author: author._id });
    await article.save();

    author.totalArticles += 1;

    if (f >= 0.7) {
      author.trustScore = Math.min(author.trustScore + 0.05, 1);
    } else if (f < 0.3) {
      author.fakeArticles += 1;
      author.trustScore = Math.max(author.trustScore - 0.1, 0);
    }

    await author.save();

    res.json({
      message: 'Article saved and author trust updated successfully',
      f,
      author
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


router.get('/author/:email', async (req, res) => {
  try {
    const author = await Author.findOne({ email: req.params.email }).lean();
    if (!author) {
          author = new Author({ name: source || 'Unknown', email: authorEmail });
  await author.save();

    }

    const articles = await Article.find({ author: author._id }).sort({ createdAt: -1 });
    res.json({ author, articles });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
