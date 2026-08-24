(function(){
/* =========================================================================
 * store.js — Shopping list state + persistence + purchase history
 * -------------------------------------------------------------------------
 * A tiny observable store (no framework) that:
 *   - holds the current shopping list items (id, qty, unit, category, done)
 *   - persists to localStorage so the list survives reloads
 *   - records purchase history (item -> {count, lastBought}) when items are
 *     completed. This history powers the "reorder" smart suggestions.
 *   - auto-assigns categories from the knowledge base on add
 *
 * API: addItem, removeItem, updateQty, toggleDone, clearDone, clearAll,
 *      getItems, getByCategory, getHistory, subscribe, CATEGORY_*, categorize
 * ========================================================================= */
'use strict';

const D = (typeof window !== 'undefined' && window.VOICE_DATA)
  ? window.VOICE_DATA
  : (typeof module !== 'undefined' ? require('./data.js') : {});
const PRODUCTS = D.PRODUCTS || [];

const LOCAL_KEY = 'voicecart.list.v1';
const HISTORY_KEY = 'voicecart.history.v1';
const now = () => new Date().toISOString();

function loadList() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) { return {}; }
}

let items = loadList();
let history = loadHistory();
const listeners = new Set();

function emit() {
  listeners.forEach(fn => { try { fn([...items]); } catch (e) {} });
}

function persist() {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(items));
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (e) { /* storage blocked — degrade gracefully */ }
}

/* auto-categorize using the knowledge base; fall back to 'other' */
function categorize(name, id) {
  const known = PRODUCTS.find(p => p.id === id);
  if (known) return known.category;
  const n = String(name).toLowerCase();
  const keywords = {
    dairy: ['milk','cheese','butter','yogurt','cream'],
    produce: ['apple','banana','orange','carrot','broccoli','spinach','tomato','onion','potato','lettuce','strawberri','lemon','vegetable','fruit','salad'],
    protein: ['chicken','beef','salmon','fish','meat','turkey','pork','tofu'],
    bakery: ['bread','bagel','roll','croissant','muffin','cake'],
    snacks: ['chip','cookie','cracker','biscuit','nut','chocolate','candy','popcorn'],
    beverages: ['water','juice','soda','coffee','tea','beer','wine'],
    household: ['soap','toothpaste','tissue','detergent','paper','shampoo','cleaner','bleach'],
  };
  for (const [cat, words] of Object.entries(keywords)) {
    if (words.some(w => n.includes(w))) return cat;
  }
  return 'other';
}

const CATEGORY_LABELS = {
  dairy: '🥛 Dairy', produce: '🥬 Produce', protein: '🍗 Protein',
  bakery: '🍞 Bakery', snacks: '🍿 Snacks', beverages: '🥤 Beverages',
  household: '🧴 Household', pantry: '🥫 Pantry', other: '🛒 Other',
};
const CATEGORY_ORDER = ['produce', 'dairy', 'protein', 'bakery', 'snacks', 'beverages', 'pantry', 'household', 'other'];

function makeId() {
  return 'it_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
}

// -- add / merge ---------------------------------------------------------
function addItem({ name, qty = 1, unit = '', category = null }) {
  const clean = String(name || '').trim();
  if (!clean) return null;
  const cat = category || categorize(clean, null);
  const key = clean.toLowerCase() + '|' + (unit || '');
  const existing = items.find(i => (i.name.toLowerCase() + '|' + (i.unit || '')) === key);
  if (existing) {
    existing.qty += Number(qty) || 1;
    existing.updated = now();
    persist(); emit();
    return existing;
  }
  const item = {
    id: makeId(), name: clean, qty: Number(qty) || 1, unit,
    category: cat, done: false, created: now(), updated: now(),
  };
  items.push(item);
  persist(); emit();
  return item;
}

// -- mutations -----------------------------------------------------------
function removeItem(id) {
  items = items.filter(i => i.id !== id);
  persist(); emit();
}

function updateQty(id, qty) {
  const it = items.find(i => i.id === id);
  if (!it) return;
  qty = Number(qty) || 0;
  if (qty <= 0) { removeItem(id); return; }
  it.qty = qty;
  it.updated = now();
  persist(); emit();
}

function toggleDone(id) {
  const it = items.find(i => i.id === id);
  if (!it) return;
  it.done = !it.done;
  if (it.done && it.name && !it.unknown) recordPurchase(it.name);
  it.updated = now();
  persist(); emit();
}

function clearDone() {
  items = items.filter(i => !i.done);
  persist(); emit();
}

function clearAll() {
  items = [];
  persist(); emit();
}

// -- purchase history ----------------------------------------------------
function recordPurchase(name) {
  const k = name.toLowerCase();
  const prev = history[k] || { count: 0, last: null, times: [] };
  prev.count = (prev.count || 0) + 1;
  prev.last = Date.now();
  prev.times = (prev.times || []).concat(prev.last).slice(-20);
  history[k] = prev;
  persist();
}

// -- read access ---------------------------------------------------------
function getItems() { return [...items]; }
function getByCategory() {
  const map = {};
  for (const it of items) {
    (map[it.category] = map[it.category] || []).push(it);
  }
  return map;
}
function getHistory() { return history; }
function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

if (typeof window !== 'undefined' && window) {
  window.VOICESTORE = {
    addItem, removeItem, updateQty, toggleDone, clearDone, clearAll,
    getItems, getByCategory, getHistory, subscribe,
    CATEGORY_LABELS, CATEGORY_ORDER, categorize,
  };
} else if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    addItem, removeItem, updateQty, toggleDone, clearDone, clearAll,
    getItems, getByCategory, getHistory, subscribe,
    CATEGORY_LABELS, CATEGORY_ORDER, categorize,
  };
}

})();
