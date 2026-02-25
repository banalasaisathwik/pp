const Article = require('../models/Article');
async function computeTrustForSource(source, { topic=null, Nlast=10 } = {}){
  const query = topic ? { source, topic } : { source };
  const articles = await Article.find(query).sort({ createdAt: 1 }).exec();
  const N = articles.length;
  if(N === 0) return { E:0, H:0, G:0, T:0 };

  const Em = topic ? (await Article.countDocuments({ source, topic })) / N : 1;

  const Ec = (articles.reduce((s,a)=> s + a.M, 0) / N);

  const tau = 0.5; 
  const E = tau*Em + (1-tau)*Ec;

  const last = articles.slice(-Nlast);
  const p = 0.5;
  let denom = 0, weighted = 0;
  for(let i=0;i<last.length;i++){
    const w = p * Math.pow(1-p, last.length - 1 - i);
    denom += w;
    weighted += w * last[i].f;
  }
  const H = denom ? (weighted/denom + 1)/2 : 0.5; // map -1..1 to 0..1 if necessary

  const G = (articles.reduce((s,a)=> s + a.f,0) / N + 1)/2; // map to 0..1

  const gamma = 0.25, delta = 0.25;
  const T = gamma*E + delta*H + (1-gamma-delta)*G;
  return { E, H, G, T };
}

module.exports = { computeTrustForSource };
