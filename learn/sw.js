// Telugu Bata service worker.
// Strategy: network-first for navigations (with cached fallback → offline page),
// cache-first for hashed static assets and audio. Bump CACHE_VERSION to invalidate.

const CACHE_VERSION = 'v1';
const SHELL_CACHE = `telugu-bata-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `telugu-bata-runtime-${CACHE_VERSION}`;
const AUDIO_CACHE = 'telugu-bata-audio-v1'; // managed by the app, not versioned here

const BASE = self.registration.scope; // e.g. https://site/learn/

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll([BASE, BASE + 'manifest.webmanifest'])).catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith('telugu-bata-') && k !== SHELL_CACHE && k !== RUNTIME_CACHE && k !== AUDIO_CACHE)
          .map((k) => caches.delete(k)),
      ),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || !req.url.startsWith(BASE)) return;

  // Navigations: try network, fall back to cached shell (the SPA handles routes).
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put(BASE, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(BASE).then((r) => r || offlineFallback())),
    );
    return;
  }

  // Everything else under scope: cache-first with background fill.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (res.ok && (req.destination === 'script' || req.destination === 'style' || req.destination === 'font' || req.destination === 'audio' || req.url.includes('/assets/'))) {
            const copy = res.clone();
            const cacheName = req.destination === 'audio' ? AUDIO_CACHE : RUNTIME_CACHE;
            caches.open(cacheName).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => (req.destination === 'audio' ? new Response('', { status: 404 }) : offlineFallback()));
    }),
  );
});

function offlineFallback() {
  return new Response(
    '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline — Telugu Bata</title><style>body{font-family:system-ui,sans-serif;background:#FDF6EB;color:#251208;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;padding:2rem}h1{color:#D95F0A}</style></head><body><div><h1>మీరు ఆఫ్‌లైన్‌లో ఉన్నారు</h1><p>You are offline. Previously visited lessons still work — open the app again once you have a connection to load new content.</p></div></body></html>',
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}
