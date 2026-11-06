// Service Worker for 課程計畫AI審查工具 v4.3.1
const SW_VERSION = 'v4.3.1';
const CACHE_NAME = 'curriculum-v4.3.1';
const CACHE_URLS = [
  '/curriculum/',
  '/curriculum/index.html',
  '/curriculum/favicon.png',
  '/curriculum/favicon.ico',
  '/curriculum/og-image.png',
  '/curriculum/manifest.json',
  '/curriculum/成果記錄.html',
  '/curriculum/docs.html',
  '/curriculum/sample-plan.pdf',
  '/curriculum/(教學組提醒)115課程計畫撰寫注意事項說明.pdf'
];

// Install: pre-cache static assets
// v4.3.1: 以 cache:'reload' 繞過瀏覽器 HTTP 快取。GitHub Pages 的 HTML 會在瀏覽器留 10 分鐘，
// 若直接 addAll，剛部署完安裝的新 SW 可能把「舊版 index.html」存進新快取，導致一直顯示舊版。
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CACHE_URLS.map(u => new Request(u, { cache: 'reload' }))))
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

function putInCache(request, response) {
  if (response && response.status === 200) {
    const clone = response.clone();
    caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
  }
  return response;
}

// Fetch:
// - 網頁（HTML 導覽）：有網路先抓最新版（network-first），離線才用快取，確保部署後立即看到新版
// - 其他同源資源：cache-first
// - 外部資源（CDN、AI API）：不攔截
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  const isPage = req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/');
  if (isPage) {
    event.respondWith(
      fetch(req, { cache: 'no-cache' })
        .then(res => putInCache(req, res))
        .catch(() => caches.match(req, { ignoreSearch: true })
          .then(cached => cached || caches.match('/curriculum/index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => putInCache(req, res))
        .catch(() => caches.match('/curriculum/index.html'));
    })
  );
});
