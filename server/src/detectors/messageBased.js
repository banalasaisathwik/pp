// detectors/messageBased.js

const { pipeline } = require('@xenova/transformers');

let classifier;

async function getClassifier() {
  if (!classifier) {
    classifier = await pipeline(
      'sentiment-analysis',
      'Xenova/distilbert-base-uncased-finetuned-sst-2-english'
    );
  }
  return classifier;
}

function sensationalScore(text) {
  const caps = (text.match(/[A-Z]{5,}/g) || []).length;
  const exclamations = (text.match(/!/g) || []).length;
  return Math.min(1, (caps + exclamations) / 10);
}

async function computeMessageScore(text) {
  try {
    const clf = await getClassifier();
    const res = await clf(text.slice(0, 512));

    const sentiment = res[0].score;

    const sensational = sensationalScore(text);

    // combine
    return 0.7 * sentiment + 0.3 * (1 - sensational);

  } catch (err) {
    console.warn("Message model failed, fallback.");
    return 0.5;
  }
}

module.exports = { computeMessageScore };