/* =========================================================================
 * tests/nlp.test.js — headless unit tests for the NLU + suggestion engines.
 * Run with:  node tests/nlp.test.js
 * ========================================================================= */
'use strict';

const parse = require('../js/nlp.js');
const suggest = require('../js/suggestions.js');

let pass = 0, fail = 0;
function ok(desc, cond) {
  if (cond) pass++; else { fail++; console.log('  FAIL', desc); }
}
function intentOf(text, lang) { return parse(text, lang).intent; }
function firstOf(text, lang) { const p = parse(text, lang).products[0]; return p ? p.name : null; }
function firstQty(text, lang) { const p = parse(text, lang).products[0]; return p ? p.qty : null; }

console.log('\n— NLU intent tests —');
ok('add: "add milk to my list"', intentOf('add milk to my list') === 'add');
ok('add: "I need apples"', intentOf('I need apples') === 'add');
ok('add: "I want to buy bananas"', intentOf('I want to buy bananas') === 'add');
ok('add: "Add bananas to my list"', intentOf('Add bananas to my list') === 'add');
ok('remove: "remove milk from my list"', intentOf('remove milk from my list') === 'remove');
ok('list: "show my list"', intentOf('show my list') === 'list');
ok('clear: "clear my list"', intentOf('clear my list') === 'clear');
ok('help: "help"', intentOf('help') === 'help');
ok('search: "find organic apples"', intentOf('find organic apples') === 'search');

console.log('\n— NLP entities —');
ok('products: milk', firstOf('add milk to my list') === 'milk');
ok('products: apples (need)', firstOf('I need apples') === 'apples');
ok('products: bananas (want buy)', firstOf('I want to buy bananas') === 'bananas');
ok('qty: "2 bottles of water" = 2', firstQty('add 2 bottles of water') === 2);
ok('qty: "5 oranges" = 5', firstQty('buy 5 oranges') === 5);
ok('qty: "a dozen eggs" = 12', firstQty('a dozen eggs') === 12);
ok('typo: "brocolli" resolves', firstOf('add brocolli') === 'broccoli');
ok('unknown item: kept as raw', parse('add laser pointer').products[0].unknown === true);

console.log('\n— multilingual —');
ok('es: "necesito leche" → milk', firstOf('necesito leche', 'es') === 'milk');
ok('fr: "je veux du lait" → milk', firstOf('je veux du lait', 'fr') === 'milk');
ok('es intent add @ "necesito leche"', intentOf('necesito leche', 'es') === 'add');

console.log('\n— search price —');
const priceSearch = parse('find toothpaste under 5');
ok('price: intent=search', priceSearch.intent === 'search');
ok('price: priceUnder=5', priceSearch.priceUnder === 5);
ok('price: qty not polluted by price', firstQty('find toothpaste under 5') === 1);

console.log('\n— suggestion engines —');
const substitute = suggest.substituteFor('milk');
ok('substitute: milk includes almond milk', Array.isArray(substitute) && substitute.includes('almond milk'));
ok('substitute: unknown → []', suggest.substituteFor('xyzzy').length === 0);

const recs = suggest.recommend({
  items: [],
  history: {
    eggs: { count: 8, last: Date.now() - 86400000 },
    hockey: { count: 1, last: Date.now() },
  },
  month: 9, limit: 3,
});
ok('reorder: returns suggestions', Array.isArray(recs) && recs.length > 0);
ok('reorder: eggs (frequent+recent) suggested', recs.some(r => r.name === 'eggs'));
ok('reorder: one-off NOT suggested', !recs.some(r => r.name === 'hockey'));

const seasonal = suggest.recommend({ items: [], history: {}, month: 6, limit: 3 });
ok('seasonal: June lists tomatoes or strawberries', seasonal.some(r => r.name === 'tomatoes' || r.name === 'strawberries'));

console.log('\n— upgrade: remove / search edges + determinism —');
ok('remove: entity "milk" extracted', parse('remove milk from my list').products[0].name === 'milk');
ok('search: "do you have pasta" → search', intentOf('do you have pasta') === 'search');
const cheap = parse('find coffee less than 3');
ok('search: price bound "less than 3"', cheap.intent === 'search' && cheap.priceUnder === 3);
// deterministic seasonal scoring (no Math.random jitter anymore)
const a = suggest.recommend({ items: [], history: {}, month: 6, limit: 4 });
const b = suggest.recommend({ items: [], history: {}, month: 6, limit: 4 });
ok('determinism: same inputs → same suggestion names', a.map(r => r.name).join(',') === b.map(r => r.name).join(','));
// seasonal entries now carry the stable base score
const june = a.filter(r => r.id === 'season');
ok('seasonal: score is a number', june.every(r => typeof r.score === 'number' && r.score > 0));

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);