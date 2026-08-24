/* =========================================================================
 * tests/frontend.smoke.js — headless smoke test that loads the real browser
 * modules in index.html order, stubs the DOM + localStorage, and verifies
 * app.js initializes and a voice dispatch produces a list change.
 * Run: node tests/frontend.smoke.js
 * ========================================================================= */
'use strict';
const fs = require('fs');
const path = require('path');

// ---- stub DOM -----------------------------------------------------------
function makeEl() {
  return {
    classList: { toggle(){}, add(){}, remove(){}, contains: () => false },
    textContent: '', innerHTML: '', value: '', dataset: {},
    appendChild(p){ return p; }, querySelector(){ return makeEl(); },
    querySelectorAll(){ return []; }, remove(){}, focus(){}, blur(){},
    setAttribute(){}, getAttribute(){ return null; }, hidden: false,
    onclick: null, oninput: null, onkeydown: null,
  };
}
global.document = {
  querySelector: () => makeEl(),
  querySelectorAll: () => [],
  createElement: () => makeEl(),
  addEventListener(){},
  body: makeEl(),
};
global.localStorage = {
  getItem: () => null, setItem(){}, removeItem(){},
};
const win = {};
global.window = win;

// ---- load scripts in index.html order (eval so they attach window.*) -----
const ROOT = path.join(__dirname, '..');
  // ---- load scripts in index.html order (eval so they attach window.*) ----
  const order = ['js/data.js', 'js/nlp.js', 'js/speech.js', 'js/store.js', 'js/suggestions.js', 'js/ml.js', 'js/app.js'];
for (const rel of order) {
  const code = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  try {
    // eslint-disable-next-line no-eval
    (0, eval)(code);
  } catch (e) {
    console.error('LOAD FAIL', rel, '-' + e.message);
    process.exit(1);
  }
  console.log('loaded', rel);
}

// ---- exercise the app path ----------------------------------------------
let pass = 0, fail = 0;
const check = (d, c) => { if (c) pass++; else { fail++; console.log('  FAIL', d); } };

const keys = ['VOICE_DATA', 'VOICENLU', 'VOICESPEECH', 'VOICESTORE', 'VOICESUGGEST', 'VOICEML'];
for (const k of keys) check('window has ' + k, win && win[k]);

// NLU -> store dispatch shape (mirrors app.js adding a recognized item)
const parsed = win.VOICENLU('add 2 bottles of water', 'en');
check('nlp: intent=add', parsed.intent === 'add');
check('nlp: product=water x2', parsed.products[0].name === 'water' && parsed.products[0].qty === 2);

// use the store directly as the app does
const item = win.VOICESTORE.addItem({ name: parsed.products[0].name, qty: parsed.products[0].qty, category: parsed.products[0].category });
check('store: added milk/water item', !!(item && item.id));
const items = win.VOICESTORE.getItems();
check('store: getItems length >= 1', items.length >= 1);
check('store: auto-category for water', item.category === 'beverages');

// suggestions after a "purchase" (simulate toggleDone buying it)
win.VOICESTORE.toggleDone(item.id);
const recs = win.VOICESUGGEST.recommend({ items: win.VOICESTORE.getItems(), history: win.VOICESTORE.getHistory(), month: 6, limit: 3 });
check('suggest: recommend returns array', Array.isArray(recs));

console.log(`\nfrontend smoke: ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);