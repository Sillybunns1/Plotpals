/* PlotPals PWA service worker
   Supabase-friendly strategy:
   - Cache only the local app shell/assets needed to launch the app.
   - Do not cache Supabase API/storage requests as app data source of truth.
   - Let Supabase network requests pass through online.
   - If offline, the app shell still opens and local browser-saved writing remains accessible.
*/
const CACHE_VERSION = 'plotpals-pwa-shell-v1.0.0';
const APP_SHELL = [
  './',
  './index.html',
  './styles.min.css',
  './app.bundle.min.js',
  './favicon.svg',
  './icon-192.png',
  './icon-512.png',
  './manifest.webmanifest'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => cache.addAll(APP_SHELL))
  );
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

  // Supabase must stay online-first and should not be cached by the app shell cache.
  if (isSupabaseRequest(url)) return;

  // Navigation: network first, fallback to cached app shell.
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

  // Local static assets: cache first, refresh in background when online.
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
