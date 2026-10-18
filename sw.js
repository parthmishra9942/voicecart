/* =========================================================================
 * sw.js — VoiceCart service worker
 * -------------------------------------------------------------------------
 * VoiceCart is a zero-backend static PWA that calls only the browser's
 * on-device speech API (no network fetches at runtime). A cache-first
 * strategy is therefore safe: the whole app shell (HTML/CSS/JS/icons/
 * manifest) is served instantly from cache once first fetched over a
 * network, which makes the app work fully offline.
 * ========================================================================= */
'use strict';

self.addEventListener('install', (e) => {
  // Clear any stale entries from an older schema on a fresh install.
  e.waitUntil(
    Promise.resolve()
      .then(() => caches.default.keys())
      .catch(() => [])
      .then((keys) => Promise.all(keys.map((k) => caches.default.delete(k))))
      .catch(() => {})
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  // Only handle same-origin GET/HEAD for the app shell. Never intercept
  // POST (the text fallback form must reach the server untouched).
  if (req.method !== 'GET' && req.method !== 'HEAD') return;
  if (url.origin !== self.location.origin) return;
  e.respondWith(serve(req, url));
});

async function serve(req, url) {
  // Non-shell URLs (e.g. anything not part of the app) just pass through.
  if (!isShellable(url)) return fetch(req);

  try {
    const cache = await caches.default.match(url);
    if (cache) return cache;
  } catch (_) {
    /* storage busy — fall through to network */
  }

  const net = await fetch(req);
  if (net.ok) {
    const clone = net.clone();
    try { await caches.default.put(url, clone); } catch (_) { /* best-effort */ }
  }
  return net;
}

// Only static app-shell assets are cached — everything else is byte-identical
// across requests, so offline reloads always show the same shell.
function isShellable(url) {
  return ['/index.html', '/', '/styles.css', '/manifest.webmanifest'].includes(url.pathname)
    || url.pathname.startsWith('/js/')
    || url.pathname.startsWith('/icons/');
}