// Service Worker for 課程計畫AI審查工具 v3.7.0
const SW_VERSION = 'v3.7.0';
const CACHE_NAME = 'curriculum-v3.7.0';
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

// Activate: clean up old caches, notify clients of new version
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
      .then(() => {
        // HH: Notify all open windows about the new version
        self.clients.matchAll({ type: 'window' }).then(clients => {
          clients.forEach(client =>
            client.postMessage({ type: 'SW_UPDATED', version: SW_VERSION })
          );
        });
      })
  );
});

// Fetch: cache-first for same-origin, network-only for external
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
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
