// src/detectors/messageBased.js
const Sentiment = require('sentiment');
const { removeStopwords } = require('stopword');
const textStat = require('text-statistics'); // optional if you add package

const sentiment = new Sentiment();

function cleanText(text){
  if(!text) return '';
  return text.replace(/<[^>]*>/g,' ').replace(/[^a-zA-Z0-9\s\.!?]/g,' ').trim();
}

function computeMessageScore(text){
  const clean = cleanText(text);
  const words = clean.split(/\s+/).filter(Boolean);
  if(words.length === 0) return 0.5;

  // Readability: approximate using avg sentence length
  const sentences = clean.split(/[.!?]+/).filter(Boolean);
  const avgSentLen = words.length / Math.max(1, sentences.length);
  const rScore = Math.max(0, 1 - Math.min(20, avgSentLen)/20); // normalize 0..1

  // Lexical diversity
  const unique = new Set(words.map(w => w.toLowerCase()));
  const ttr = unique.size / words.length;

  // Sentiment: prefer neutral/objective
  const s = sentiment.analyze(clean);
  const polarity = (s.score + 10) / 20; // map -10..10 to 0..1
  const subjectivityPenalty = 1 - Math.min(1, Math.abs(polarity - 0.5)*2);

  // Punctuation/emphasis
  const exclam = (clean.match(/!/g) || []).length;
  const allcaps = (clean.match(/\b[A-Z]{3,}\b/g) || []).length;
  const emph = Math.min(1, (exclam + allcaps)/5);
  const pScore = 1 - emph;

  // combine weights (tweak later)
  const M = 0.3*rScore + 0.3*ttr + 0.2*subjectivityPenalty + 0.2*pScore;
  return Math.max(0, Math.min(1, M));
}

module.exports = { computeMessageScore };
