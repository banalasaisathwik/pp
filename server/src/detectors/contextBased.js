// detectors/contextBased.js

const nlp = require('compromise');

function sourceScore(url) {
  if (!url) return 0.5;

  if (url.includes("gov") || url.includes("edu")) return 0.9;
  if (url.includes("news") || url.includes("bbc")) return 0.8;
  if (url.includes("blog") || url.includes("unknown")) return 0.4;

  return 0.6;
}

function entityConsistency(text) {
  const doc = nlp(text);

  const people = doc.people().out('array');
  const places = doc.places().out('array');

  const density = (people.length + places.length) / (text.split(' ').length);

  return Math.min(1, density * 10);
}

async function computeContextScore(url, title, text) {
  try {
    const sScore = sourceScore(url);
    const eScore = entityConsistency(text);

    const titleMatch =
      text.toLowerCase().includes(title.toLowerCase()) ? 1 : 0.5;

    return 0.4 * sScore + 0.4 * eScore + 0.2 * titleMatch;

  } catch {
    return 0.5;
  }
}

module.exports = { computeContextScore };