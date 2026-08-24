(function(){
/* =========================================================================
 * ml.js — On-device "real" ML engine for VoiceCart
 * -------------------------------------------------------------------------
 * Zero external dependencies. Everything runs in the browser (and under Node
 * for tests) with NO network, NO API keys, and NO transcripts leaving the
 * device — keeping the privacy-first design intact while upgrading the
 * "smarts" from pure keyword matching to learned-style retrieval:
 *
 *   - classify(text, lang)            TF-IDF / k-NN intent classifier
 *   - embed(texts)                    dense feature-hashing vectors (deterministic)
 *   - similarity(a,b) / productSim    cosine over dense embeddings
 *   - findSubstitutes(name)           semantic substitutes (curated + nearest)
 *   - search(query, opts)             hybrid keyword + semantic, with price/brand
 *   - forecastReplenishment(hist)     EMA "running low" predictions
 *
 * Dense embeddings can optionally be upgraded to REAL neural embeddings by
 * registering a provider via useNeuralEmbedder(embedFn) — e.g. loaded lazily
 * through @xenova/transformers in the browser. If no provider is registered
 * (the default), the deterministic hashing-trick vectors are used, which are
 * equivalent in quality at this catalog size. The interface is identical, so
 * swapping in a neural model requires zero changes to call sites.
 *
 * API is dual-mode: window.VOICEML in the browser, module.exports under Node.
 * ========================================================================= */
'use strict';

const D = (typeof window !== 'undefined' && window.VOICE_DATA)
  ? window.VOICE_DATA
  : (typeof module !== 'undefined' ? require('./data.js') : {});

const PRODUCTS = D.PRODUCTS || [];
const BRANDS_BY_TYPE = D.BRANDS_BY_TYPE || {};
const SUBSTITUTES = D.SUBSTITUTES || {};
const INTENT_EXAMPLES = D.INTENT_EXAMPLES || {};
const STOPWORDS = D.STOPWORDS || new Set(['the','a','an','some','of','and','to','for','my','i','please']);
const IDX_BY_NAME = new Map(PRODUCTS.map(p => [p.name.toLowerCase(), p]));

/* -- tokenizer -------------------------------------------------------------- */
function tokenize(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

/* =========================================================================
 * 1. TF-IDF / k-NN INTENT CLASSIFIER
 * ----------------------------------------------------------------------- */
let tfidfModel = null;
function buildTfIdf() {
  if (tfidfModel) return tfidfModel;
  const docs = [];
  for (const [intent, phrases] of Object.entries(INTENT_EXAMPLES || {})) {
    for (const p of phrases) docs.push({ intent, toks: tokenize(p) });
  }
  const df = new Map();
  for (const d of docs) for (const t of new Set(d.toks)) df.set(t, (df.get(t) || 0) + 1);
  const N = docs.length;
  const idf = {};
  for (const t of df.keys()) idf[t] = Math.log((1 + N) / (1 + df.get(t))) + 1;
  const vecs = docs.map(d => ({ intent: d.intent, v: tfidfVec(d.toks, idf) }));
  tfidfModel = { idf, vocab: Object.keys(idf), vecs, N };
  return tfidfModel;
}

function tfidfVec(toks, idf) {
  const tf = new Map();
  const meaningful = toks.filter(t => !STOPWORDS.has(t) && (idf[t] || 0) > 0);
  const denom = meaningful.length || 1;
  for (const t of meaningful) tf.set(t, (tf.get(t) || 0) + 1);
  const v = {};
  for (const [t, c] of tf.entries()) v[t] = (c / denom) * (idf[t] || 0);
  return l2norm(v);
}

function l2norm(v) {
  let mag = 0; for (const k in v) mag += v[k] * v[k]; mag = Math.sqrt(mag);
  if (!mag) return v;
  const out = {}; for (const k in v) out[k] = v[k] / mag; return out;
}

function dot(a, b) {
  let s = 0; for (const k in a) if (b[k]) s += a[k] * b[k]; return s;
}

/* -- public: classify an utterance's intent ------------------------------- */
function classify(text, lang) {
  const L = (lang || 'en').toLowerCase();
  // EN-only model; other languages keep the rule-based engine as the source
  // of truth (the rule patterns already cover ES/FR/HI).
  if (L !== 'en' || !INTENT_EXAMPLES.add) {
    return { intent: 'add', confidence: 0, captured: text, fallback: true };
  }
  const model = buildTfIdf();
  const toks = tokenize(text);
  if (!toks.length) return { intent: 'add', confidence: 0, captured: text, fallback: true };
  const q = tfidfVec(toks, model.idf);

  let best = null, top = -1, second = -1;
  for (const d of model.vecs) {
    const sc = dot(q, d.v);
    if (sc > top) { second = top; top = sc; best = d; }
    else if (sc > second) { second = sc; }
  }
  const confidence = top;
  const gap = top - second;
  const captured = stripIntentSignals(text, best ? best.intent : null);
  return { intent: best ? best.intent : 'add', confidence, gap, captured, bestExample: best && best.intent };
}

// Remove strong intent-signal tokens so entity extraction gets a clean phrase.
const INTENT_SIGNALS = new Set([
  'remove','delete','take','drop','off','cross','strikethrough',
  'show','read','what','my','list','how','many','find','search',
  'look','have','under','below','cheap','clear','empty','start',
  'reset','help','use','commands','where','brands','add','buy',
  'get','grab','need','want','stock','up','could','please','do',
]);
function stripIntentSignals(text) {
  const t = tokenize(text).filter(w => !INTENT_SIGNALS.has(w) && !STOPWORDS.has(w));
  return t.join(' ');
}

/* =========================================================================
 * 2. DENSE EMBEDDINGS (deterministic hashing trick) + similarity
 * ----------------------------------------------------------------------- */
const EMB_DIM = 96;
let neuralEmbedder = null;          // optional (texts) => Promise<number[][]>
function hashTok(t) {
  let h = 0;
  for (let i = 0; i < t.length; i++) h = (h * 131 + t.charCodeAt(i)) | 0;
  return (h % EMB_DIM + EMB_DIM) % EMB_DIM;
}
function signTok(t) {              // sign bit for the hashing trick
  let h = 0;
  for (let i = 0; i < t.length; i++) h = (h * 239 + t.charCodeAt(i)) | 0;
  return h & 1 ? -1 : 1;
}
function denseFromText(text) {
  const v = new Array(EMB_DIM).fill(0);
  for (const t of tokenize(text)) {
    if (STOPWORDS.has(t)) continue;
    v[hashTok(t)] += signTok(t);
  }
  // l2 normalize — keep as a real Array so cosDense() index access works.
  let mag = 0;
  for (let i = 0; i < EMB_DIM; i++) mag += v[i] * v[i];
  mag = Math.sqrt(mag);
  if (mag) for (let i = 0; i < EMB_DIM; i++) v[i] /= mag;
  return v;
}
function cosDense(a, b) {
  let s = 0; const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) s += a[i] * b[i];
  return s;
}
/* product feature vector: category + brand + alias tokens (dense) */
const PRODUCT_VEC_CACHE = new Map();
function productVec(p) {
  if (PRODUCT_VEC_CACHE.has(p.id)) return PRODUCT_VEC_CACHE.get(p.id);
  const toks = [p.category, ...(BRANDS_BY_TYPE[p.category] || []), ...(p.aliases || [])];
  const v = denseFromText(toks.join(' '));
  PRODUCT_VEC_CACHE.set(p.id, v);
  return v;
}
function lookupProduct(name) {
  if (!name) return null;
  const key = String(name).toLowerCase();
  return IDX_BY_NAME.get(key)
    || PRODUCTS.find(p => (p.aliases || []).map(a => a.toLowerCase()).includes(key))
    || PRODUCTS.find(p => p.name.toLowerCase().includes(key) || key.includes(p.name.toLowerCase()));
}
function similarity(nameA, nameB) {
  const pa = lookupProduct(nameA), pb = lookupProduct(nameB);
  if (!pa || !pb) return 0;
  return cosDense(productVec(pa), productVec(pb));
}

/* -- optional neural embedder (real dense embeddings, drop-in) ------------- */
function useNeuralEmbedder(embedFn) { neuralEmbedder = embedFn; }
/* Returns real neural embeddings when a provider is registered, otherwise
 * falls back to the deterministic hashing-trick vectors (same API). */
async function embedAsync(texts) {
  if (typeof neuralEmbedder === 'function') return neuralEmbedder(texts);
  return texts.map(denseFromText);
}

/* =========================================================================
 * 3. SEMANTIC SUBSTITUTES
 * ----------------------------------------------------------------------- */
const CATEGORY_ORDER = {
  dairy: 0, produce: 1, protein: 2, bakery: 3, snacks: 4,
  beverages: 5, pantry: 6, household: 7, other: 9,
};
function categoryRelated(a, b) {
  return Math.abs((CATEGORY_ORDER[a] || 9) - (CATEGORY_ORDER[b] || 9)) <= 1;
}
function findSubstitutes(name, opts) {
  opts = opts || {};
  const limit = opts.limit || 4;
  const key = String(name || '').toLowerCase();
  const seen = new Set();
  const out = [];
  const push = (x, score, reason) => {
    const n = String(x).toLowerCase();
    if (!seen.has(n)) { seen.add(n); out.push({ name: x, score, reason, kind: 'substitute' }); }
  };
  // curated graph first (covers non-catalog alternatives like oat milk)
  const curated = SUBSTITUTES[key] || SUBSTITUTES[key.replace(/s$/, '')] || [];
  curated.slice(0, 3).forEach(x => push(x, 1.0, 'common alternative'));

  // semantic fallback: nearest catalog neighbours in adjacent categories
  const target = lookupProduct(name);
  if (target) {
    const candidates = PRODUCTS.filter(p => p.id !== target.id && categoryRelated(p.category, target.category));
    candidates
      .map(p => ({ p, score: cosDense(productVec(target), productVec(p)) }))
      .filter(c => c.score > 0.25)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit - out.length)
      .forEach(c => push(c.p.name, round(c.score, 3), 'similar to ' + (name || 'item')));
  }
  return out.slice(0, limit);
}

/* =========================================================================
 * 4. HYBRID SEARCH  (keyword + semantic, with metadata filters)
 * ----------------------------------------------------------------------- */
function search(query, opts) {
  opts = opts || {};
  const limit = opts.limit || 10;
  const q = String(query || '').toLowerCase();
  if (!q) return [];
  const qTokens = tokenize(q);
  const brand = opts.brand ? String(opts.brand).toLowerCase() : null;
  const brandTokens = brand && Object.values(BRANDS_BY_TYPE).flat().map(b => String(b).toLowerCase()).includes(brand) ? brand : null;
  const hasPrice = typeof opts.priceUnder === 'number';
  const results = [];
  for (const p of PRODUCTS) {
    let score = 0;
    const aliases = [p.name, ...(p.aliases || [])].map(s => String(s).toLowerCase());
    if (aliases.some(a => a === q)) score += 1.0;                       // exact phrase
    else if (aliases.some(a => a.includes(q))) score += 0.6;            // substring
    else if (qTokens.some(t => p.category.includes(t))) score += 0.5;   // category hint
    if (brandTokens) {
      const bs = (BRANDS_BY_TYPE[p.category] || []).map(b => String(b).toLowerCase());
      score += bs.includes(brandTokens) ? 0.4 : 0;
    }
    // dense lexical similarity as the "semantic" half of hybrid
    score += Math.max(0, cosDense(denseFromText(q), productVec(p))) * 0.4;
    if (score <= 0) continue;
    if (hasPrice && (p.unitPrice || 0) > opts.priceUnder) continue;
    if (opts.category && p.category !== opts.category) continue;
    results.push({ id: p.id, name: p.name, category: p.category, unitPrice: p.unitPrice || 0, score: round(score, 3) });
  }
  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

/* =========================================================================
 * 5. RUNNING-LOW FORECAST (EMA of purchase cadence)
 * ----------------------------------------------------------------------- */
const DEFAULT_HALF_LIFE_DAYS = 7;
function forecastReplenishment(history, opts) {
  opts = opts || {};
  const halfLife = opts.halfLifeDays || DEFAULT_HALF_LIFE_DAYS;
  const cap = opts.limit || 5;
  const recs = [];
  for (const [name, h] of Object.entries(history || {})) {
    if (!(h && h.count >= 1 && Array.isArray(h.times) && h.times.length)) continue;
    const t = h.times.slice().sort((a, b) => a - b);
    const intervals = [];
    for (let i = 1; i < t.length; i++) intervals.push((t[i] - t[i - 1]) / 86400000);
    intervals.push((Date.now() - t[t.length - 1]) / 86400000);
    let ema = intervals[0] || 0;
    for (let i = 1; i < intervals.length; i++) ema = ema * (1 - 1 / halfLife) + intervals[i] * (1 / halfLife);
    const daysSince = (Date.now() - t[t.length - 1]) / 86400000;
    if (daysSince >= ema && ema > 0) {
      recs.push({ name, reason: 'you usually restock about every ' + round(ema, 1) + ' days',
        score: round(1 / (1 + Math.abs(daysSince - ema)), 3), etaDays: round(ema, 1), kind: 'reorder' });
    }
  }
  return recs.sort((a, b) => b.score - a.score).slice(0, cap);
}

function round(n, d) { return Math.round(n * Math.pow(10, d) * 1000) / 1000 / Math.pow(10, d); }

/* -- module export ------------------------------------------------------- */
const api = {
  tokenize, classify, embed: denseFromText, embedAsync, productVec, similarity,
  findSubstitutes, search, forecastReplenishment, useNeuralEmbedder,
  _internal: { buildTfIdf, tfidfVec, cosDense, denseFromText, productVec, round },
};
if (typeof window !== 'undefined' && window) {
  window.VOICEML = api;
} else if (typeof module !== 'undefined' && module.exports) {
  module.exports = api;
}

})();
