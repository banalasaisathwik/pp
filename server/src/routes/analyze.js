const express = require('express');
const router = express.Router();
const { calculateAndUpdateScores } = require('../services/scoreService');
const { scrapeArticleFromUrl } = require('../services/scrapeService');

router.post('/', async (req, res) => {
  const { url, title, text, source, authorEmail } = req.body;
  if (!authorEmail) return res.status(400).json({ error: 'authorEmail required' });

  try {
    const scraped = url ? await scrapeArticleFromUrl(url) : null;
    const articleInput = {
      url: scraped?.url || url,
      title: title || scraped?.title,
      text: text || scraped?.text,
      source: source || scraped?.source,
      authorEmail
    };

    if (!articleInput.text) return res.status(400).json({ error: 'text or url required' });

    const result = await calculateAndUpdateScores(articleInput);
    res.json({
      ...result,
      scraped
    });
  } catch (err) {
    console.error(err);
    const scrapeHint = url
      ? ' Could not scrape this URL automatically. Paste the article text manually or try another URL.'
      : '';
    res.status(err.statusCode || 500).json({
      error: `${err.message || 'internal error'}${scrapeHint}`
    });
  }
});

module.exports = router;
