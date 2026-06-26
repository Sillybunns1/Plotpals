/* PlotPals PWA service worker
   Supabase-friendly strategy:
   - Cache only local app shell/assets needed to launch the app.
   - Do not cache Supabase API/storage requests.
   - Supabase remains online-first for cloud sync.
*/
const CACHE_VERSION = 'plotpals-pwa-shell-v1.0.2';
const APP_SHELL = [
  './',
  './index.html',
  './styles.min.css',
  './app.bundle.min.js',
  './modules/pwa.js',
  './modules/current-systems.js',
  './favicon.svg',
  './icon-192.png',
  './icon-512.png',
  './manifest.webmanifest'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    await Promise.all(APP_SHELL.map(async asset => {
      try {
        const response = await fetch(asset, { cache: 'reload' });
        if (response && response.ok) await cache.put(asset, response);
      } catch (error) {
        console.warn('PlotPals skipped app-shell cache item:', asset, error);
      }
    }));
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE_VERSION).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

function isSupabaseRequest(url) {
  return /\.supabase\.co$/i.test(url.hostname) || url.hostname.includes('.supabase.co');
}

function isLocalAppAsset(url) {
  return url.origin === self.location.origin;
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (isSupabaseRequest(url)) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put('./index.html', copy)).catch(() => {});
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  if (isLocalAppAsset(url)) {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      const networkFetch = fetch(request).then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(request, copy)).catch(() => {});
        }
        return response;
      }).catch(() => null);
      return cached || networkFetch || Response.error();
    })());
  }
});
