const CACHE = 'lie-detector-v2';

// Install: don't block on caching — just activate immediately
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then(cache => {
      // Soft cache — errors won't block SW install
      return cache.addAll([
        '/Scanner/',
        '/Scanner/index.html',
        '/Scanner/manifest.json',
      ]).catch(() => {
        // If any static file fails, still install successfully
        console.log('[SW] Pre-cache partial — continuing anyway');
      });
    })
  );
});

// Activate: clear old caches, take control immediately
self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      caches.keys().then(keys =>
        Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
      ),
      self.clients.claim()
    ])
  );
});

// Fetch: network-first for live data, cache-first for app shell
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = event.request.url;

  // Always live: data APIs, CDN scripts, fonts
  if (
    url.includes('yahoo.com') ||
    url.includes('corsproxy.io') ||
    url.includes('unpkg.com') ||
    url.includes('fonts.googleapis.com') ||
    url.includes('fonts.gstatic.com')
  ) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response('Offline', { status: 503, statusText: 'Service Unavailable' })
      )
    );
    return;
  }

  // App shell: cache-first, update in background
  event.respondWith(
    caches.match(event.request).then(cached => {
      const networkFetch = fetch(event.request).then(response => {
        if (response && response.status === 200 && response.type !== 'opaque') {
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);

      return cached || networkFetch;
    })
  );
});
