(function(){
/* =========================================================================
 * suggestions.js — Smart Suggestion engine
 * -------------------------------------------------------------------------
 * Three real, explainable recommendation signals, all computed locally:
 *
 *   1. REORDER  — "you usually buy X"  based on purchase-frequency and
 *                 recency from store.getHistory() (spaced-repetition-ish:
 *                 frequent + recently-bought items are the ones you re-need).
 *   2. SEASONAL — produce availability for the current month from the
 *                 embedded 12-month calendar (data.js).
 *   3. SUBSTITUTE — alternatives from the product graph when an item is
 *      unavailable or the user wants a swap.
 *
 * A scored API is exposed for testing: recommend({history, currentNames}),
 * returning arrays of {name, reason, kind, score}.
 * ========================================================================= */
'use strict';

const D = (typeof window !== 'undefined' && window.VOICE_DATA)
  ? window.VOICE_DATA
  : (typeof module !== 'undefined' ? require('./data.js') : {});
const PRODUCTS = D.PRODUCTS || [];
const SUBSTITUTES = D.SUBSTITUTES || {};
const SEASONAL = D.SEASONAL || {};

/* -- 1. REORDER suggestions ---------------------------------------------- */
function reorderSuggestions(history, limit = 3) {
  const entries = Object.entries(history || {});
  const scored = entries
    .filter(([, h]) => h && h.count > 0)
    .map(([name, h]) => {
      const elapsedDays = (Date.now() - (h.last || 0)) / 86400000;
      // score favours frequently-purchased and recently-purchased items
      const score = (h.count || 1) * 10 - Math.min(elapsedDays, 45);
      return { name, reason: 'running low / you often buy this', score, count: h.count };
    })
    .filter(r => r.count >= 2);            // needs evidence, not a one-off
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

/* ---- 2. Seasonal suggestions ------------------------------------------- */
function seasonalSuggestions(month, limit = 3) {
  const inSeason = SEASONAL[month] || [];
  return inSeason
    .map(name => {
      const prod = PRODUCTS.find(p => p.name === name);
      return { name, reason: `in season this month`, score: 8, product: prod || null };
    })
    .slice(0, limit);
}

/* ---- 3. Substitute suggestions ---------------------------------------- */
function substituteFor(itemName) {
  const key = String(itemName || '').toLowerCase();
  // exact
  if (SUBSTITUTES[key]) return SUBSTITUTES[key];
  // singular / partial match
  const base = key.replace(/s$/, '');
  if (SUBSTITUTES[base]) return SUBSTITUTES[base];
  for (const [k, v] of Object.entries(SUBSTITUTES)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  return [];
}

/* ---- aggregate: produce an ordered recommendation list ------------------ */
function recommend({ items = [], history = {}, month = new Date().getMonth() + 1, limit = 5 } = {}) {
  const recs = [];

  const currentNames = items.map(i => String(i.name).toLowerCase());
  const reorder = reorderSuggestions(history, 3);
  for (const r of reorder) {
    if (!currentNames.includes(r.name)) recs.push({ id: 'reorder', name: r.name, reason: r.reason, score: r.score });
  }

  const seasonal = seasonalSuggestions(month, 4);
  for (const s of seasonal) {
    if (!currentNames.includes(s.name)) recs.push({ id: 'season', name: s.name, reason: s.reason, score: s.score });
  }

  // substitute for last item added (if any)
  return recs.sort((a, b) => b.score - a.score).slice(0, limit);
}

/* -- module --------------------------------------------------------------- */
if (typeof window !== 'undefined' && window) {
  window.VOICESUGGEST = { recommend, reorderSuggestions, seasonalSuggestions, substituteFor };
} else if (typeof module !== 'undefined' && module.exports) {
  module.exports = { recommend, reorderSuggestions, seasonalSuggestions, substituteFor };
}

})();
