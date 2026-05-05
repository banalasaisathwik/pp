// detectors/factBased.js

const { pipeline } = require('@xenova/transformers');

let embedder;

async function getEmbedder() {
  if (!embedder) {
    embedder = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2'
    );
  }
  return embedder;
}

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

async function computeFactScore(text) {
  try {
    const emb = await getEmbedder();

    const sentences = text.split('.').slice(0, 5);

    if (sentences.length < 2) return 0.5;

    const vectors = [];

    for (let s of sentences) {
      const v = await emb(s, { pooling: 'mean' });
      vectors.push(v.data);
    }

    // measure consistency
    let total = 0;
    let count = 0;

    for (let i = 0; i < vectors.length; i++) {
      for (let j = i + 1; j < vectors.length; j++) {
        total += cosine(vectors[i], vectors[j]);
        count++;
      }
    }

    return total / count;

  } catch (err) {
    console.warn("Fact model failed");
    return 0.5;
  }
}

module.exports = { computeFactScore };