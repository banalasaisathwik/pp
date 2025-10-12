const express = require('express');
const router = express.Router();
const { calculateAndUpdateScores } = require('../services/scoreService');

router.post('/', async (req, res) => {
  const { url, title, text, source, authorEmail } = req.body;
  if (!text) return res.status(400).json({ error: 'text required' });
  if (!authorEmail) return res.status(400).json({ error: 'authorEmail required' });

  try {
    const result = await calculateAndUpdateScores({ url, title, text, source, authorEmail });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal error', details: err.message });
  }
});

module.exports = router;
