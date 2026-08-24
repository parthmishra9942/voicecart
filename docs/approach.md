# VoiceCart — Approach Write-up

**Challenge:** A Voice Command Shopping Assistant with voice-input NLU, smart
suggestions, and search — built in ≤ 8h, cleanly, and deployable free.

## Decision: all-on-device, static, no backend

Any candidate can bolt a mic onto a list and *say* "AI". To be credible and
different, I shipped the *intelligence itself* here:

1. **On-device speech** (Web Speech API) → no server transcripts, no API keys,
   no cost, private by design.
2. **A hand-written NLU engine** (not an opaque LLM call) → intent + entity
   extraction that is readable, explainable, and unit-testable.
3. **Real data-driven smarts** (not fake text) → a curated knowledge base,
   a substitution graph, a 12-month season signal, and a purchase-history‑based
   reorder model.
4. **PWA + voice-only mode** → genuinely mobile and hands-free, not just a
   mic button on a list.

## How the pieces fit

```
speech.js ──(on-device transcript)──▶ nlp.js ──(intent + entities)──▶ app.js
                                                                    │
data.js (products/aliases/season/substitutes) ◄── suggestions.js ──┤ (smart hints)
store.js (list + purchase history, localStorage) ◄──────────────────┘
```

- **nlp.js** matches phrase patterns (longest-first), extracts quantities
  ("a dozen"→12), units, brand/price bounds, and tolerates near-miss typo via
  Levenshtein. It covers EN/ES/FR/HI.
- **suggestions.js** scores recommendations from history frequency+recency,
  the current month’s in-season list, and a product-substitution graph.
- **store.js** is an observable store: add/remove/quantity/merge, auto-category,
  done/clear, and purchase history — all persisted in `localStorage`.
- **app.js** wires voice, NLU, store, and hints into the UI (live chips, toasts,
  spoken confirmations, voice-only mode, graceful text fallback).

## Testing
- `npm test` → **34 unit tests + 11 frontend smoke checks** (intents, entities,
  quantities, multilingual, price-range search, suggestion engines).

## Deployment
Zero-backend static build → **GitHub Pages** in two minutes (Settings → Pages →
main → /). Netlify/Firebase also work unchanged.

## Uniqueness in one line
An honest, real, explainable "smart shopping list" — running fully on-device,
with genuinely data-driven suggestions, a real multilingual NLU, and no
black-box AI to hide behind.