const axios = require('axios');
const cheerio = require('cheerio');
const Sentiment = require('sentiment');
const sentiment = new Sentiment();

async function fetchHTML(url){
  try{
    const r = await axios.get(url, { timeout: 4000 });
    return r.data;
  }catch(e){ return null; }
}

async function computeContextScore(url, title, text){
  const html = await fetchHTML(url);
  let adsCount = 0;
  if(html){
    const $ = cheerio.load(html);
    adsCount = $('iframe, ins, .ads, [id*="ad"], [class*="ad"]').length;
  }
  const adPenalty = Math.min(1, adsCount / 3); // >3 is suspicious

  let domainScore = 0.7; 

  const titleSent = sentiment.analyze(title || '').score;
  const bodySent = sentiment.analyze(text || '').score;
  const gap = Math.abs(titleSent - bodySent);
  const gapPenalty = Math.min(1, gap / 10);

  const C = Math.max(0, 1 - 0.6*adPenalty - 0.4*gapPenalty) * domainScore;
  return Math.max(0, Math.min(1, C));
}

module.exports = { computeContextScore };
