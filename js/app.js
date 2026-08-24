/* =========================================================================
 * app.js — VoiceCart controller
 * -------------------------------------------------------------------------
 * Wires together data.js, nlp.js, speech.js, store.js and suggestions.js:
 *   - renders the shopping list grouped by category
 *   - owns the voice interaction loop (listening HUD, live transcript,
 *     intent dispatch, spoken + toast confirmation)
 *   - provides voice/text search with brand & price-range filtering
 *   - shows smart suggestions (reorder/seasonal/substitute)
 *   - exposes a voice-only interaction mode for hands-free use
 *
 * The module expects the other scripts to have populated window.* globals
 * (they are loaded first in index.html). It is intentionally browser-only.
 * ========================================================================= */
'use strict';

/* -- virtual DOM aliases (kept short; real browser DOM is assumed) -------- */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel, scope) => Array.from((scope || document).querySelectorAll(sel));

const store = window.VOICESTORE;
const nlp = window.VOICENLU;
const speech = window.VOICESPEECH;
const ml = window.VOICEML || null;      // optional on-device ML engine

let currentLang = 'en';
let audioEnabled = true;
let isListening = false;
let voiceOnly = false;

/* -- helpers ------------------------------------------------------------- */
function toast(msg, kind) {
  const t = document.createElement('div');
  t.className = 'toast ' + (kind || 'info');
  t.textContent = msg;
  $('#toasts').appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

function speakLine(text) {
  if (!audioEnabled || !text) return;
  speech.speak(text, { lang: currentLang });
}

/* ------------------------------------------------------------------------
 * Intent resolution — rule-based NLU is the source of truth, but the on-device
 * TF-IDF/k-NN classifier (ml.classify) is consulted to catch paraphrases the
 * pattern matcher would miss ("we ran out of milk" → add). ML only overrides
 * when it is confident AND disagrees with the rule engine; otherwise the rule
 * engine's explainable result wins. A clarification fallback fires when ML can't
 * make sense of the utterance at all.
 * ----------------------------------------------------------------------- */
function parseIntent(text) {
  const parsed = nlp(text, currentLang);
  if (ml && currentLang === 'en') {
    const mc = ml.classify(text, 'en');
    if (mc.confidence >= 0.70 && mc.gap >= 0.10 && mc.intent !== parsed.intent) {
      parsed.intent = mc.intent;
      if (mc.captured) parsed.captured = mc.captured;
    }
    if (mc.confidence < 0.15 && mc.gap < 0.05 && String(text).length > 3) {
      parsed._clarify = true;        // genuinely unrecognised → ask, don't guess
    }
  }
  return parsed;
}

/* Substitute suggestions: prefer the semantic (ML) engine, fall back to the
 * curated substitution graph when ML isn't loaded. */
function substituteTip(name) {
  if (ml && typeof ml.findSubstitutes === 'function') {
    return ml.findSubstitutes(name).map(s => s.name);
  }
  return speech_substitute(name);
}

/* -------------------------------------------------------------------------
 * Intent dispatch — the single place translated voice becomes actions.
 * ------------------------------------------------------------------------ */
function dispatch(p) {
  const { intent, products, priceUnder, brand, captured } = p;
  if (intent === 'help') { showHelp(); return; }
  if (intent === 'list') { toast('Here is your shopping list'); listConfirm(); return; }
  if (intent === 'clear') { store.clearAll(); toast('List cleared'); speakLine('List cleared'); return; }

  if (intent === 'search') {
    runSearch(products[0] ? products[0].name || captured : captured, { priceUnder, brand });
    return;
  }

  if (intent === 'remove') {
    const what = products[0];
    const found = findItemByName(what ? what.name : captured);
    if (!found) { toast("I couldn't find that on your list", 'warn'); speakLine("I couldn't find that"); }
    else {
      store.removeItem(found.id);
      toast('Removed ' + found.name);
      speakLine('Removed ' + found.name);
    }
    return;
  }

    if (intent === 'add') {
    const prod = products[0];
    if (!prod) { toast('Sorry, I did not catch that', 'warn'); return; }
    if (prod.unknown) {
      store.addItem({ name: prod.name, qty: prod.qty, unit: prod.unit });
      toast('Added ' + prod.name);
    } else {
      const item = store.addItem({ name: prod.name, qty: prod.qty, unit: prod.unit, category: prod.category });
      if (!item) { toast('Nothing to add', 'warn'); return; }
      toast('Added ' + (prod.qty > 1 ? prod.qty + ' ' : '') + prod.name);
      speakLine('Added ' + (prod.qty > 1 ? prod.qty + ' ' : '') + prod.name);
      // surface a semantic substitute when relevant
      const subs = substituteTip(prod.name);
      if (subs.length) {
        setTimeout(() => toast('Tip: try ' + subs.slice(0, 2).join(' or '), 'tip'), 1200);
      }
    }
  }
}

/* -- small helpers used above -------------------------------------------- */
function findItemByName(name) {
  const key = String(name || '').toLowerCase();
  return store.getItems().find(i => i.name.toLowerCase() === key || i.name.toLowerCase().includes(key));
}
function speech_substitute(name) {
  // convenience: route to suggestions module via window
  return (window.VOICESUGGEST && window.VOICESUGGEST.substituteFor(name)) || [];
}
function listConfirm() {
  const n = store.getItems().length;
  speakLine('You have ' + n + ' items on your list');
}

function showHelp() {
  toast('Say: "add milk", "remove eggs", "find apples", "show my list", "clear my list"', 'info');
}

/* -------------------------------------------------------------------------
 * Search with filtering (name/brand/price range).
 * ----------------------------------------------------------------------- */
function runSearch(query, opts) {
  opts = opts || {};
  const q = String(query || '').toLowerCase();
  const kb = (window.VOICE_DATA && window.VOICE_DATA.PRODUCTS) || [];
  let results = kb.filter(p =>
    !q || p.name.includes(q) || p.category.includes(q)
  );
  if (opts.brand) results = results.filter(p => {
    const brands = (window.VOICE_DATA && window.VOICE_DATA.BRANDS_BY_TYPE) || {};
    return (brands[p.category] || []).some(b => b.toLowerCase().includes(opts.brand.toLowerCase()));
  });
  if (opts.priceUnder) results = results.filter(p => (p.unitPrice || 0) <= opts.priceUnder);
  renderSearchResults(results, opts);
}

/* -------------------------------------------------------------------------
 * Rendering — shopping list grouped by category.
 * ------------------------------------------------------------------------- */
function renderList() {
  const container = $('#listContainer');
  const map = store.getByCategory();
  const order = (store.CATEGORY_ORDER || []);
  container.innerHTML = '';
  let count = 0;
  for (const cat of order) {
    const items = map[cat];
    if (!items || !items.length) continue;
    count += items.length;
    const label = (store.CATEGORY_LABELS && store.CATEGORY_LABELS[cat]) || cat;
    const col = document.createElement('div');
    col.className = 'category';
    col.innerHTML = '<h3>' + label + ' <span class="count">' + items.length + '</span></h3>';
    const ul = document.createElement('ul');
    for (const it of items) {
      const li = document.createElement('li');
      li.className = 'item' + (it.done ? ' done' : '');
      const qty = (it.qty > 1 ? it.qty + '× ' : '') + it.name + (it.unit ? ' ' + it.unit : '');
      li.innerHTML =
        '<button class="check" data-done="' + it.id + '" aria-label="toggle">' + (it.done ? '✓' : '○') + '</button>' +
        '<div class="item-text"><span class="name' + (it.done ? ' strike' : '') + '">' + esc(qty) + '</span>' +
        '<span class="qty">$' + estPrice(it) + '</span></div>' +
        '<div class="item-actions"><button class="icon" data-q="' + it.id + '" data-delta="-1" aria-label="less">−</button>' +
        '<button class="icon" data-q="' + it.id + '" data-delta="1" aria-label="more">+</button>' +
        '<button class="icon del" data-del="' + it.id + '" aria-label="delete">✕</button></div>';
      ul.appendChild(li);
    }
    col.appendChild(ul);
    container.appendChild(col);
  }
  $('#itemCount').textContent = count + ' item' + (count === 1 ? '' : 's');
  if (!count) container.innerHTML = '<div class="empty">Your list is empty.<br>Say or type an item.</div>';
  bindActions(container);
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function estPrice(it) {
  const kb = (window.VOICE_DATA && window.VOICE_DATA.PRODUCTS) || [];
  const p = kb.find(x => x.name === it.name.toLowerCase());
  return p ? (p.unitPrice * it.qty).toFixed(2) : '?';
}

/* -------------------------------------------------------------------------
 * Search results panel.
 * ----------------------------------------------------------------------- */
function renderSearchResults(results, opts) {
  const panel = $('#searchResults');
  $('#searchPanel').classList.add('show');
  if (!results.length) {
    panel.innerHTML = '<div class="search-none">No products matched. Try a different name or price.</div>';
    return;
  }
  let html = '';
  for (const r of results) {
    const tag = opts.brand ? ' <em>organic</em>' : '';
    html += '<div class="search-result">' +
      '<div><strong>' + esc(r.name) + '</strong>' + tag + '<span class="cat"> · ' + r.category + '</span></div>' +
      '<div class="row">~ $' + (r.unitPrice || 0).toFixed(2) +
      (opts.priceUnder ? ' <span class="ok">under budget</span>' : '') +
      ' <button class="mini" data-addsearch="' + esc(r.name) + '">Add</button></div></div>';
  }
  panel.innerHTML = html;
  $$('.search-result').forEach(el => {
    const btn = el.querySelector('[data-addsearch]');
    if (btn) btn.onclick = () => { store.addItem({ name: btn.dataset.addsearch }); renderList(); toast('Added ' + btn.dataset.addsearch); };
  });
}

/* -------------------------------------------------------------------------
 * Bind list action buttons.
 * ----------------------------------------------------------------------- */
function bindActions(container) {
  $$('[data-done]', container).forEach(b => {
    b.onclick = () => { store.toggleDone(b.dataset.done); renderList(); };
  });
  $$('[data-q]', container).forEach(b => {
    b.onclick = () => {
      const it = store.getItems().find(i => i.id === b.dataset.q);
      if (it) store.updateQty(it.id, it.qty + parseInt(b.dataset.delta || 1, 10));
      renderList();
    };
  });
  $$('[data-del]', container).forEach(b => {
    b.onclick = () => { store.removeItem(b.dataset.del); renderList(); toast('Removed'); };
  });
}
let currentRecorder = null;

/* -------------------------------------------------------------------------
 * Voice HUD + loop.
 * ----------------------------------------------------------------------- */
function setListeningUI(on) {
  isListening = on;
  $('#voiceToggle').classList.toggle('active', on);
  $('#listenHud').classList.toggle('show', on);
  $('#listenStatus').textContent = on ? 'Listening…' : '';
  $('#interim').textContent = '';
  if (!on) $('#listenHud').classList.remove('show');
}

function handleFinalTranscript(finalText) {
  $('#interim').textContent = '';
  const text = (finalText || '').trim();
  if (!text) { toast('Sorry, I did not catch that', 'warn'); return; }
  $('#lastRecognized').textContent = text;
  $('#listenStatus').textContent = 'Processing…';          // visible pipeline state
  const parsed = parseIntent(text);
  if (parsed._clarify) {
    setListeningUI(false);
    toast('Sorry, I didn\'t catch an action — try "add milk" or "find milk".', 'warn');
    return;
  }
  dispatch(parsed);
  setListeningUI(false);
  refreshSuggestions();
}

function toggleListening() {
  if (isListening) { currentRecorder && currentRecorder.stop(); setListeningUI(false); return; }
  const enabled = speech.isSpeechSupported();
  if (!enabled) {
    toast('Voice isn\u2019t supported in this browser — I\u2019ve opened text input.', 'warn');
    $('#textInput').focus();
    return;
  }
  const rec = new speech.SpeechRecorder({
    onResult: (all, fin) => {
      $('#interim').textContent = all || '';
      if (fin) handleFinalTranscript(fin);
    },
  });
  const started = rec.start(currentLang);
  currentRecorder = rec;
  setListeningUI(true);
  if (!started) { setListeningUI(false); }
}

/* -------------------------------------------------------------------------
 * Suggestions panel (reorder / seasonal).
 * ----------------------------------------------------------------------- */
function refreshSuggestions() {
  const box = $('#suggestions');
  const sg = window.VOICESUGGEST;
  if (!sg) return;
  const recs = sg.recommend({
    items: store.getItems(),
    history: store.getHistory(),
    month: new Date().getMonth() + 1,
    limit: 4,
  });
  box.innerHTML = '';
  if (!recs.length) {
    box.innerHTML = '<p class="hint">Suggestions will appear here once you start shopping.</p>';
    return;
  }
  for (const r of recs) {
    const div = document.createElement('div');
    div.className = 'suggestion';
    div.innerHTML = '<span class="why">' + esc(r.reason) + '</span>' +
      ' <button class="mini" data-s="' + esc(r.name) + '">' + esc(r.name) + '</button>';
    box.appendChild(div);
  }
  $$('#suggestions .suggestion').forEach(el => {
    const b = el.querySelector('[data-s]');
    if (b) b.onclick = () => {
      store.addItem({ name: b.dataset.s });
      renderList(); refreshSuggestions(); toast('Added ' + b.dataset.s);
    };
  });
}

/* -------------------------------------------------------------------------
 * Language switch.
 * ----------------------------------------------------------------------- */
function setLang(lang) {
  currentLang = lang;
  const labels = {
    en: 'Voice: English', es: 'Voz: Español', fr: 'Voix: Français', hi: 'आवाज़: हिंदी',
  };
  $('#langLabel').textContent = labels[lang] || lang;
  $$('#langMenu button').forEach(b => b.classList.toggle('on', b.dataset.lang === lang));
}

/* -------------------------------------------------------------------------
 * Text input path (fallback + voice-only convenience).
 * ----------------------------------------------------------------------- */
function submitText() {
  const val = $('#textInput').value.trim();
  if (!val) return;
  $('#textInput').value = '';
  $('#lastRecognized').textContent = val;
  const parsed = parseIntent(val);
  if (parsed._clarify) { toast('Not sure what you want — try "add milk" or "find apples".', 'warn'); return; }
  dispatch(parsed);
  refreshSuggestions();
}

function toggleVoiceOnly() {
  voiceOnly = !voiceOnly;
  $('#voiceOnlyBtn').classList.toggle('active', voiceOnly);
  if (voiceOnly) { $('#textBox').classList.add('hidden'); } else { $('#textBox').classList.remove('hidden'); }
  toast(voiceOnly ? 'Voice-only mode on — just talk to it.' : 'Voice-only mode off.');
}

/* -------------------------------------------------------------------------
 * Init.
 * ----------------------------------------------------------------------- */
function init() {
  store.subscribe(renderList);

  $('#voiceToggle').onclick = toggleListening;
  $('#sendBtn').onclick = submitText;
  $('#textInput').onkeydown = (e) => { if (e.key === 'Enter') submitText(); };
  $('#clearAll').onclick = () => { store.clearAll(); toast('List cleared'); };
  $('#clearDone').onclick = () => { store.clearDone(); toast('Completed removed'); refreshSuggestions(); };
  $('#voiceOnlyBtn').onclick = toggleVoiceOnly;

  // language pill toggles the menu
  $('#langLabel').onclick = () => $('#langMenu').classList.toggle('hidden');

  // typed search wired bespoke (bespoke panel, not a full NLU pass)
  $('#searchBox').oninput = () => {
    const q = $('#searchBox').value.trim();
    if (!q) { $('#searchPanel').classList.remove('show'); return; }
    runSearch(q, {});
  };

  // language menu buttons
  $$('#langMenu button').forEach(b => b.onclick = () => { setLang(b.dataset.lang); $('#langMenu').classList.add('hidden'); });

  // suggestions update on list change
  store.subscribe(refreshSuggestions);

  renderList();
  refreshSuggestions();
  setLang('en');
  offlineReadyHint();
}

// One-time, non-blocking "this is a real PWA" hint once the service worker
// is active (so the app truly works offline / installs to home screen).
function offlineReadyHint() {
  try {
    if (typeof navigator === 'undefined' || !navigator.serviceWorker) return;
    if (!navigator.serviceWorker.controller) return;      // not activated yet
    if (sessionStorage.getItem('voicecart.offlineHint')) return;
    sessionStorage.setItem('voicecart.offlineHint', '1');
    toast('PWA ready — install from the browser menu to use offline', 'tip');
  } catch (e) { /* sessionStorage or navigator unavailable — ignore */ }
}

if (typeof window !== 'undefined' && window) {
  // safeguard: if a required module is missing, alert instead of hard fail
  const missing = ['VOICESTORE', 'VOICENLU', 'VOICESPEECH'].filter(k => !window[k]);
  if (missing.length) {
    if (typeof console !== 'undefined' && console.error) console.error('[VoiceCart] missing modules: ' + missing.join(', '));
    document.addEventListener('DOMContentLoaded', () => {
      const box = $('#errorBox');
      if (box) box.textContent = 'Missing module(s): ' + missing.join(', ');
    });
  } else {
    init();
  }
}