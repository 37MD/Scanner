// Lie Detector Scanner — Service Worker v2E
const CACHE_NAME = 'ld-scanner-v2e';

// Assets to pre-cache for offline use
const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon.svg',
  // CDN dependencies — cached on first load
  'https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap',
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone/babel.min.js',
];

// Install: pre-cache shell assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Cache local assets reliably; CDN with no-cors best-effort
      const local = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];
      return cache.addAll(local).then(() => self.skipWaiting());
    })
  );
});

// Activate: clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch strategy:
// - CDN JS/CSS (unpkg, fonts): Cache-first (they're versioned/static)
// - NSE API / CORS proxy / Yahoo Finance: Network-only (live data must be fresh)
// - Everything else: Stale-while-revalidate
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Live market data — always network, never cache
  if (
    url.includes('nseindia.com') ||
    url.includes('cors-proxy') ||
    url.includes('finance.yahoo.com') ||
    url.includes('generativelanguage.googleapis.com')
  ) {
    event.respondWith(fetch(event.request));
    return;
  }

  // CDN static assets — cache-first
  if (
    url.includes('unpkg.com') ||
    url.includes('fonts.googleapis.com') ||
    url.includes('fonts.gstatic.com')
  ) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // App shell — stale-while-revalidate
  event.respondWith(
    caches.open(CACHE_NAME).then(cache =>
      cache.match(event.request).then(cached => {
        const network = fetch(event.request).then(response => {
          if (response && response.status === 200 && event.request.method === 'GET') {
            cache.put(event.request, response.clone());
          }
          return response;
        }).catch(() => cached);
        return cached || network;
      })
    )
  );
});
