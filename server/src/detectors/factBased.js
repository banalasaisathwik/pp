// src/detectors/factBased.js
const tf = require('@tensorflow/tfjs');
const use = require('@tensorflow-models/universal-sentence-encoder');

const axios = require('axios');

let USE_MODEL = null;
async function getModel(){
  if(USE_MODEL) return USE_MODEL;
  USE_MODEL = await use.load();
  return USE_MODEL;
}

async function wikiSummaryForQuery(query){
  try{
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
    const r = await axios.get(url);
    return r.data.extract || null;
  }catch(e){
    return null;
  }
}

// compute semantic similarity (cosine) between two strings
async function cosineSim(a, b){
  const model = await getModel();
  const embeddings = await model.embed([a, b]);
  const embA = embeddings.slice([0,0],[1,embeddings.shape[1]]);
  const embB = embeddings.slice([1,0],[1,embeddings.shape[1]]);
  const dot = embA.dot(embB.transpose()).dataSync()[0];
  const normA = embA.norm().dataSync()[0];
  const normB = embB.norm().dataSync()[0];
  const cos = dot / (normA*normB + 1e-10);
  return cos;
}

async function computeFactScore(text){
  const sentences = (text.match(/[^.!?]+[.!?]+/g) || []).slice(0,6); // first few claims
  if(sentences.length === 0) return 0.5;
  let supported = 0;
  for(const s of sentences){
    // build query from first few words (MVP)
    const q = s.split(' ').slice(0,6).join(' ').replace(/[^a-zA-Z0-9\s]/g,'');
    const wiki = await wikiSummaryForQuery(q);
    if(wiki){
      const sim = await cosineSim(s, wiki);
      if(sim > 0.55) supported++;
    }
  }
  return supported / sentences.length;
}

module.exports = { computeFactScore, getModel };
