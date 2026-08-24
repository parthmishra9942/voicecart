(function(){
/* =========================================================================
 * nlp.js — Explainable rule-based NLU engine for VoiceCart
 * -------------------------------------------------------------------------
 * A transparent, offline, multilingual intent + entity extraction layer.
 * Instead of a black-box LLM API it matches phrase patterns and extracts
 * products, quantities, units, price bounds and brands explicitly — so every
 * decision is explainable, has zero running cost, and is privacy-first (the
 * transcript never leaves the browser).
 *
 * API: parse(transcript, lang) -> {
 *   intent, captured, products:[{id,name,qty,unit,category}],
 *   priceUnder, brand, lang, rawText
 * }
 * ========================================================================= */
'use strict';

const D = (typeof window !== 'undefined' && window.VOICE_DATA)
  ? window.VOICE_DATA
  : (typeof module !== 'undefined' ? require('./data.js') : {});

const PRODUCTS        = D.PRODUCTS || [];
const ALIAS_MAP       = D.ALIAS_MAP || {};
const INTENT_PATTERNS = D.INTENT_PATTERNS || {};
const QUANTITY_WORDS  = D.QUANTITY_WORDS || {};
const UNIT_WORDS      = D.UNIT_WORDS || [];

const HINGLISH = {
  'doodh':'milk','dudh':'milk','doodh':'milk','ande':'eggs','anda':'egg','chawal':'rice','aloo':'potatoes','aaloo':'potatoes','pyaz':'onions','pyaaz':'onions','tamatar':'tomatoes','roti':'bread','tel':'oil','sabun':'soap','shampoo':'shampoo','biscuit':'biscuits',
  'do':'two','teen':'three','char':'four','ek':'one','ekdum':'one','packet':'packet','packets':'packets',
  'add':'add','hatao':'remove','hata':'remove','nikal':'remove','dikhao':'show','dhoondo':'find','dhundo':'find','chahiye':'need',
  'karo':'do','kar':'do','de':'do','dena':'do','do':'two'
};
function normalizeLangText(text, lang){
  let t=String(text||'');
  const L=(lang||'en').toLowerCase();
  if(L==='hi' || /\b(doodh|dudh|ande|chawal|aloo|pyaz|tamatar|karo|kar do|hatao|dikhao|dhoondo)\b/i.test(t)){
    t=t.toLowerCase().replace(/[०-९]/g, c=>String('०१२३४५६७८९'.indexOf(c)));
    for(const [a,b] of Object.entries(HINGLISH)) t=t.replace(new RegExp('\\b'+a+'\\b','gi'),b);
    t=t.replace(/\bkar\s+do\b/g,'').replace(/\bkar\s+dena\b/g,'').replace(/\badd\s+do\b/g,'add').replace(/\bhatao\s+do\b/g,'remove');
  }
  return t;
}

/* -- normalize: lowercase, strip punctuation/accents, collapse spaces ------ */
function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[.,!?;:'"()]/g, ' ')
    .replace(/[áàâäã]/g, 'a').replace(/[éèêë]/g, 'e')
    .replace(/[íìîï]/g, 'i').replace(/[óòôöõ]/g, 'o')
    .replace(/[úùûü]/g, 'u').replace(/ñ/g, 'n').replace(/ç/g, 'c')
    .replace(/\s+/g, ' ').trim();
}

/* -- trim leading conversational words (please/okay) — not phrases ------ */
function leadTrim(tokens) {
  const leads = new Set(['please','okay','ok','alright','hey','yo','so','let me']);
  let i = 0;
  while (i < tokens.length && leads.has(tokens[i])) i++;
  return tokens.slice(i);
}

/* -- greedy pattern match, returns captured %IT% string ('' if exact) ------ */
function matchPattern(pattern, seq) {
  const parts = pattern.split('%IT%');
  const head = parts[0].split(' ').filter(Boolean);
  // exact pattern with no slot
  if (parts.length === 1) {
    if (head.length !== seq.length) return null;
    for (let h = 0; h < head.length; h++) if (seq[h] !== head[h]) return null;
    return '';
  }
  const tail = parts[1].split(' ').filter(Boolean);
  let i = 0;
  if (head.length) {
    if (seq.length < head.length) return null;
    for (let h = 0; h < head.length; h++) if (seq[h] !== head[h]) return null;
    i = head.length;
  }
  if (tail.length) {
    for (let t = 0; t < tail.length; t++) {
      if (seq[seq.length - tail.length + t] !== tail[t]) return null;
    }
  }
  const cap = seq.slice(i, tail.length ? seq.length - tail.length : seq.length);
  return cap.length ? cap.join(' ') : '';
}

/* -- product resolution helpers -------------------------------------------- */
function idToProduct(id) {
  return PRODUCTS.find(p => p.id === id) || null;
}

function singularize(word) {
  if (word.length > 3 && word.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (word.length > 4 && word.endsWith('es')) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss') && !word.endsWith('us')) return word.slice(0, -1);
  return word;
}

/* Levenshtein distance for typo tolerance */
function lev(a, b) {
  const m = a.length, n = b.length;
  let prev = new Array(n + 1).fill(0), curr = new Array(n + 1).fill(0);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    const t = prev; prev = curr; curr = t;
  }
  return prev[n];
}

function resolveProduct(str) {
  const s = normalize(str);
  if (ALIAS_MAP[s]) return idToProduct(ALIAS_MAP[s]);
  const words = s.split(' ');
  for (const w of words) {
    if (ALIAS_MAP[w]) { const p = idToProduct(ALIAS_MAP[w]); if (p) return p; }
  }
  const sing = singularize(s);
  if (sing && ALIAS_MAP[sing]) { const p = idToProduct(ALIAS_MAP[sing]); if (p) return p; }

  // closest-match against a single product name — only for near-similar typo
  const sWords = normalize(str).split(' ').filter(Boolean);
  // multi-word phrases without a token alias are not good fuzzy candidates
  if (sWords.length > 1) return null;
  let best = null, bestScore = Infinity;
  for (const p of PRODUCTS) {
    const d = lev(sWords[0] || '', normalize(p.name));
    if (d < bestScore) { bestScore = d; best = p; }
  }
  return (best && bestScore <= 2) ? best : null;
}

/* -- extract quantity + unit from a captured phrase ----------------------- */
function extractQtyAndUnit(captured) {
  const tokens = normalize(captured).split(' ').filter(Boolean);
  const words = [];
  let qty = 1;
  let unit = '';
  for (let i = 0; i < tokens.length; i++) {
    const w = tokens[i];
    if (w === 'dozen' || (w === 'a' && tokens[i + 1] === 'dozen')) {
      qty = 12; if (w === 'a') i++;
      continue;
    }
    if (QUANTITY_WORDS[w] !== undefined) { qty = QUANTITY_WORDS[w]; continue; }
    if (UNIT_WORDS.includes(w)) { unit = w; continue; }
    words.push(w);
  }
  return { qty, unit, name: words.join(' ') };
}

/* =========================================================================
 * parse(transcript, lang) — detect intent + extract entities.
 * ========================================================================= */
function parse(transcript, lang) {
  const L = (lang || 'en').toLowerCase();
  const text = normalize(normalizeLangText(transcript, L));
  const tokens = leadTrim(text.split(' ').filter(Boolean));

  let intent = 'add';          // additive is the default human behavior
  let captured = '';
  let priceUnder = null;
  let brand = null;

  // -- price bound ("under 5", "less than $5") forces a search intent
  const priceMatch = text.match(/(?:under|below|less than)\s*(?:\$|usd\s*)?(\d+(?:\.\d+)?)/);
  if (priceMatch) priceUnder = parseFloat(priceMatch[1]);

  // -- intent detection (priority order; longest/specific patterns first)
  const order = ['remove', 'list', 'search', 'clear', 'add', 'help'];
  outer:
  for (const intentKey of order) {
    const patterns = (INTENT_PATTERNS[intentKey] && INTENT_PATTERNS[intentKey][L]) || [];
    const sorted = [...patterns].sort((a, b) => b.length - a.length);
    for (const pat of sorted) {
      const cap = matchPattern(pat, tokens);
      if (cap !== null) {
        intent = intentKey;
        captured = cap.trim();
        if (priceUnder) intent = 'search';   // price bound dominates
        break outer;
      }
    }
  }

  // -- default additive: if no pattern matched, treat the full text as the item
  if (intent === 'add' && captured === '' && tokens.length) {
    captured = tokens.join(' ');
  }

  // -- entities
  const products = [];
  if (captured && intent !== 'list' && intent !== 'clear' && intent !== 'help') {
    let captureForEntity = captured;
    // for a price search ("under 5"), don't read the price as a quantity
    if (priceUnder && priceMatch) {
      captureForEntity = captureForEntity.replace(priceMatch[0], ' ').replace(/\b(dollars|dollar|usd|bucks)\b/g, ' ');
    }
    const { qty, unit, name } = extractQtyAndUnit(captureForEntity);
    const prod = resolveProduct(name);
    if (prod) {
      products.push({ id: prod.id, name: prod.name, qty, unit, category: prod.category });
    } else {
      products.push({ id: null, name: (name || captured).trim(), qty, unit, unknown: true });
    }
  }

  // -- brand / attribute extraction for search phrases
  if (intent === 'search' && /\borganic\b/.test(text)) brand = 'Organic';

  return { intent, captured, products, priceUnder, brand, lang: L, rawText: transcript };
}

/* -- export (browser uses window.VOICENLU; Node tests use require) --------- */
if (typeof window !== 'undefined' && window) {
  window.VOICENLU = parse;
} else if (typeof module !== 'undefined' && module.exports) {
  module.exports = parse;
}

})();
