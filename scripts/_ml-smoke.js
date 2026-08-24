const ml = require('../js/ml.js');
const c = ml.classify('we ran out of milk');
console.log('intent', c.intent, 'conf', c.confidence.toFixed(2), 'cap', JSON.stringify(c.captured));
console.log('intent remove eggs', ml.classify('take eggs off my list').intent,
  'list', ml.classify('what is on my list').intent,
  'search', ml.classify('find toothpaste under 5').intent,
  'clear', ml.classify('start over').intent,
  'help', ml.classify('what can i do').intent);
console.log('subs milk', ml.findSubstitutes('milk').map(s => s.name));
console.log('subs kiwi', ml.findSubstitutes('kiwi').map(s => s.name));
console.log('subs xyzzy', ml.findSubstitutes('xyzzy').map(s => s.name));
console.log('search toothpaste', ml.search('toothpaste').slice(0, 3).map(r => r.name));
console.log('search under 1', ml.search('toothpaste', { priceUnder: 1 }).length);
console.log('search organic apples', ml.search('organic apples').slice(0, 2).map(r => r.name));
const ap = require('../js/data.js').PRODUCTS.find(p => p.name === 'apples');
const i = ml._internal;
console.log('DEBUG apples cos', i.cosDense(i.denseFromText('organic apples'), i.productVec(ap)).toFixed(3),
  'apple-alone', i.cosDense(i.denseFromText('apples'), i.productVec(ap)).toFixed(3),
  'qvec-sum', i.denseFromText('organic apples').reduce((s,x)=>s+x*x,0).toFixed(3));
const hist = { milk: { count: 5, last: Date.now() - 86400000 * 9, times: [Date.now() - 86400000 * 30, Date.now() - 86400000 * 23, Date.now() - 86400000 * 9] } };
console.log('forecast', ml.forecastReplenishment(hist).map(r => r.name + '/' + r.etaDays));
