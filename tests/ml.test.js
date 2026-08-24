/* =========================================================================
 * tests/ml.test.js — headless tests for the on-device ML engine (ml.js):
 *   - TF-IDF/k-NN intent classifier (paraphrase coverage + confidence)
 *   - semantic substitutes (curated + nearest-neighbour fallback)
 *   - hybrid search (keyword + vector, price/brand filters)
 *   - running-low EMA forecast
 *   - determinism (no Math.random in the path)
 * Run: node tests/ml.test.js
 * ========================================================================= */
'use strict';

const ml = require('../js/ml.js');

let pass = 0, fail = 0;
function ok(desc, cond) {
  if (cond) pass++; else { fail++; console.log('  FAIL', desc); }
}

/* -------------------- intent classification ------------------------------- */
console.log('\n— intent classification —');
const intents = [
  ['add', ['i need milk', 'grab milk', 'we ran out of milk', 'could you add eggs', 'two apples please']],
  ['remove', ['take milk off', 'delete eggs', 'drop the cheese', 'i do not need this anymore']],
  ['list', ['show me my list', 'what is on my list', 'read my list']],
  ['search', ['find toothpaste', 'do you have milk', 'look for coffee']],
  ['clear', ['clear my list', 'start over', 'empty it']],
  ['help', ['help', 'how do i use this', 'what can i do']],
];
for (const [exp, phrases] of intents) {
  for (const p of phrases) {
    const got = ml.classify(p, 'en').intent;
    ok('classify intent: "' + p + '" → ' + exp, got === exp);
  }
}

// ML should catch paraphrases the rule engine misses
ok('classify: "we ran out of milk" → add (paraphrase)', ml.classify('we ran out of milk', 'en').intent === 'add');
const milkC = ml.classify('we ran out of milk', 'en');
ok('classify: paraphrase confidence is decent', milkC.confidence > 0.15);

// rule engine still works as fallback for non-EN
ok('classify: non-EN falls back (add default)', ml.classify('necesito leche', 'es').intent === 'add');

/* -------------------- substitutes ---------------------------------------- */
console.log('\n— substitutes —');
const milkSubs = ml.findSubstitutes('milk');
ok('substitute: milk surfaces oat/almond milk', milkSubs.some(s => /oat milk|almond milk/.test(s.name)));
ok('substitute: returns <= limit', milkSubs.length <= 4);
ok('substitute: unknown item falls back to similar catalog items', ml.findSubstitutes('bananas').length > 0);
ok('substitute: truly unknown → []', ml.findSubstitutes('xyzzy').length === 0);

/* -------------------- hybrid search ---------------------------------------- */
console.log('\n— hybrid search —');
const tp = ml.search('toothpaste');
ok('search: toothpaste found', tp.length && tp[0].name === 'toothpaste');
const ap = ml.search('organic apples');
ok('search: organic apples → apples', ap.length && ap[0].name === 'apples');
ok('search: brand filter', ml.search('apples', { brand: 'Organic' }).length === 1 && ml.search('apples', { brand: 'Organic' })[0].name === 'apples');
ok('search: price filter drops expensive', ml.search('toothpaste', { priceUnder: 1 }).length === 0);

/* -------------------- determinism ---------------------------------------- */
console.log('\n— determinism —');
const a1 = ml.classify('add milk', 'en');
const a2 = ml.classify('add milk', 'en');
ok('classify: deterministic', a1.intent === a2.intent && a1.confidence === a2.confidence);
ok('search: deterministic ranking',
  JSON.stringify(ml.search('apples').map(r => r.name)) === JSON.stringify(ml.search('apples').map(r => r.name)));

/* -------------------- running-low forecast ------------------------------- */
console.log('\n— running-low forecast —');
const now = Date.now();
const history = {
  milk: { count: 6, last: now - 86400000 * 9, times: [now - 86400000 * 30, now - 86400000 * 23, now - 86400000 * 9] },
  eggs: { count: 2, last: now - 86400000 * 1, times: [now - 86400000 * 5, now - 86400000 * 1] },  // recently bought → not due
};
const due = ml.forecastReplenishment(history, { limit: 5 });
ok('forecast: milk flagged as running low', due.some(r => r.name === 'milk'));
ok('forecast: recently bought eggs NOT flagged', !due.some(r => r.name === 'eggs'));

console.log(`\nml: ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
