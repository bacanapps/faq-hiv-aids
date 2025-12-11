/* PWA Service Worker – safe for GitHub Pages subpaths */
const VERSION = 'v202512111000'; // bump on each deploy to avoid stale caches
const CACHE_NAME = `faq-cache-${VERSION}`;

// Only cache the shell. Data is network-first.
const CORE = [
  './',
  './index.html',
  './app.js',
  './assets/css/theme.css',
  './assets/css/app.css',
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  'https://unpkg.com/howler/dist/howler.min.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(CORE);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k.startsWith('faq-cache-') && k !== CACHE_NAME) ? caches.delete(k) : null));
    await self.clients.claim();
  })());
});

// Helper: treat your JSON as network-first; everything else cache-first
function isDataRequest(req) {
  try {
    const url = new URL(req.url);
    return url.pathname.endsWith('/data/faq.json');
  } catch { return false; }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle GET, same-origin
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  if (!sameOrigin) return;

  // Network-first for JSON data
  if (isDataRequest(req)) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req, { cache: 'no-store' });
        if (fresh && fresh.ok) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(req, fresh.clone());
        }
        return fresh;
      } catch (e) {
        const cached = await caches.match(req);
        return cached || new Response('[]', { headers: { 'Content-Type': 'application/json' } });
      }
    })());
    return;
  }

  // Cache-first for app shell / static
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const fresh = await fetch(req);
      const cache = await caches.open(CACHE_NAME);
      cache.put(req, fresh.clone());
      return fresh;
    } catch (e) {
      return cached || Response.error();
    }
  })());
});