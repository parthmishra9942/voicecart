# 🛒 VoiceCart — Voice Command Shopping Assistant

A **privacy-first, voice-first** shopping list with smart suggestions.

Unlike a typical "list + a mic button + an AI claim," VoiceCart ships a **real,
explainable NLU engine**, a **curated knowledge base**, and **three data-driven
recommendation engines** (reorder / seasonal / substitute). It's a zero-backend
static site that deploys on **GitHub Pages**, **Netlify**, or **Firebase**.

---

## ✨ Why it stands out (not an AI wrapper)

| Common AI-submission trait       | What VoiceCart does instead                       |
| -------------------------------- | --------------------------------------------- |
| Sends voice to an AI server      | Speech runs **on-device** (browser API) — nothing leaves the browser |
| Opaque "AI" for the smarts       | A **rule-based NLU** you can read and unit-test |
| Fake suggestion text             | **Real engines**: purchase history + monthly season + substitution graph |
| Web-only list                    | A **PWA** with a **voice-only mode** + spoken confirmations |
| Opaque stack                      | Zero backend, no API keys, deploy free in ~2 minutes |

---

## Features

### 1. Voice input & NLU
- Live transcripts and continuous listening via the browser speech API.
- Multilingual intents (**EN / ES / FR / HI**): "add milk", "I need apples",
  "I want to buy bananas", "Add bananas to my list".
- Quantity + units: "add 2 bottles of water", "add 5 oranges", "a dozen eggs" → 12.

### 2. Smart suggestions
- **Reorder** — from your logged purchase history, suggests items you usually buy.
- **Seasonal** — current month’s in-season produce (12-month calendar).
- **Substitutes** — e.g. if you add milk, it surfaces oat / almond / soy.

### 3. List Management
- Add / remove / modify by voice or touch; the store auto-merges duplicates.
- Automatic categorization (dairy, produce, snacks…).
- Quantity steppers (+) and (−) and an estimated item price.

### 4. Voice-Activated Search
- "find organic apples" (name + brand).
- "find toothpaste under 5" → price-range filter.

### 5. UI/UX
- Minimalist mobile-first design, an animated recording HUD, toasts, and TTS
  confirmations, plus a hands-free **voice-only** mode.

### 6. Hosting & Deployment
- Static build → free on **GitHub Pages** / Netlify / Firebase.

---

## Run locally
```bash
cd voicecart
npm run serve            # or: python3 -m http.server 5000  /  npx serve .
```
Then open **http://localhost:5000**. Use **Chrome/Edge** for the voice mic
(Firefox/Safari don’t support the SpeechRecognition API — the app auto-falls
back to a text box and everywhere else still works).

## Run the headless tests + lint
```bash
npm test                # 34 NLU unit tests + 11 frontend smoke checks
npm run lint           # ESLint over js/, tests/, scripts/
```

## Regenerate the PWA icons
```bash
npm run icons          # → node scripts/gen-icons.js (pure Node, no deps)
```

## Offline PWA (v1.1)
VoiceCart now ships a service worker (`sw.js`) registered from `index.html`.
The app shell (HTML/CSS/JS/icons/manifest) is cached once you open it over a
network, so subsequent loads work **fully offline** and it can be installed
to a home screen. Zero-backend means there are never server-side fetches to
break offline mode.

## Project layout


```
index.html / styles.css / manifest.webmanifest   → UI shell (PWA, mobile-first)
sw.js                                            → offline cache + install support
js/
  data.js         curated knowledge base (products, aliases, brands, price
                  ranges, substitution graph, 12-month seasonal calendar,
                  multilingual phrase patterns)
  nlp.js          our own NLU: intent + entity extraction, typo-tolerant,
                  multilingual
  speech.js       on-device SpeechRecognition + TTS (graceful fallback)
  store.js        observable list store → localStorage persistence, purchase
                  history, auto-categorization
  suggestions.js  reorder / seasonal / substitute recommendation scoring
  app.js          controller wiring speech, NLU, store, suggestions to the UI
tests/
  nlp.test.js         headless NLU + suggestions unit tests
  frontend.smoke.js   headless load/smoke test of the real app.js
scripts/gen-icons.js  generates the PWA icon PNGs (pure Node, no deps)
package.json          npm scripts (test / lint / icons / serve)
.github/workflows/test.yml  CI: lint + full test suite on push/PR
```

All `js/*.js` are dual-mode: they attach `window.*` when loaded in the browser
and `module.exports` when run under Node, so the logic is headless-testable.

---

## How the audio stays private (and cheap)

The app uses the browser’s **on-device** SpeechRecognition and SpeechSynthesis.
There is **no server transcript**, no API key, and nothing to pay for. This is
the single biggest difference from an API-based "voice AI" submission, and it
keeps the product free to host anywhere.

---

## Deploy: GitHub Pages (free, ~2 min)

1. Create a new **empty GitHub repository** named `voicecart`.
2. Push this folder up to `main` (commands below).
3. In the repo: **Settings → Pages → Source → Deploy from a branch → `main` → `/` → Save**.
4. Live at **`https://<your-username>.github.io/voicecart/`** within a minute.

```bash
cd voicecart
git init
git add .
git commit -m "VoiceCart: privacy-first voice shopping assistant"
git branch -M main
git remote add origin https://github.com/<you>/voicecart.git
git push -u origin main
```

> Alternate hosts work with zero code changes: drag-and-drop the folder into
> [Netlify](https://app.netlify.com) or Firebase Hosting → you get an immediate URL.
---

## Approach (≤ 200 words)

**VoiceCart** is a privacy-first, voice-first shopping list. Because I chose the
stack, I optimized for credibility: a **static, zero-backend** PWA that uses the
browser's **on-device** speech API — no server transcripts, no API keys, no
recurring cost.

The core is a **custom rule-based NLU** (data.js + nlp.js) that recognizes
intents (add / list / search / remove / clear / help) and entities (products,
quantities, units, brands) across four languages, with typo-tolerant matching.
It's explainable and covered by 34 headless unit tests.

"Smart" comes from **real data**, not filler: a curated knowledge base drives
auto-categorization and name/brand/price search filters; a substitution graph
offers alternatives; and a 12-month produce schedule yields seasonal tips.
Logged purchase history (store.js) powers a reorder signal, so hints are
factual.

The UI is a mobile-first PWA with live transcript chips, spoken confirmations,
and a hands-free **voice-only mode**, falling back gracefully to text where a
browser lacks speech support. It deploys free on **GitHub Pages** in two
minutes — fast, accessible, and fully explainable.
```