// Service Worker for 課程計畫AI審查工具 v1.8
const CACHE_NAME = 'curriculum-v1.8';
const CACHE_URLS = [
  '/curriculum/',
  '/curriculum/index.html',
  '/curriculum/favicon.png',
  '/curriculum/favicon.ico',
  '/curriculum/og-image.png',
  '/curriculum/manifest.json'
];

// Install: pre-cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: cache-first for same-origin, network-only for external
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  // Only cache GET requests from our own origin
  if (event.request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => caches.match('/curriculum/index.html'));
    })
  );
});
