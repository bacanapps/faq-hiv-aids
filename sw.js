// Bump the cache name whenever assets change to ensure clients fetch the latest files
const CACHE_NAME = "faq-pwa-cache-v2";
const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/app.js",
  "/manifest.json",
  "/data/presentation.json",
  "/data/faq.json",
  "/assets/img/hero.png",
  "/assets/audio/presentation.mp3",
  "/assets/audio/faq1.mp3",
  "/assets/audio/faq2.mp3",
  "/assets/audio/faq3.mp3",
  "/assets/audio/faq4.mp3",
  "/assets/audio/faq5.mp3",
  "/assets/audio/faq6.mp3",
  "/assets/audio/faq7.mp3",
  "/assets/audio/faq8.mp3",
  "/assets/audio/faq9.mp3",
  "/assets/audio/faq10.mp3",
  "/assets/audio/faq11.mp3",
  // external libs for offline once cached
  "https://unpkg.com/react@17/umd/react.development.js",
  "https://unpkg.com/react-dom@17/umd/react-dom.development.js",
  // react-router-dom removed: not needed for the modern FAQ
  "https://unpkg.com/howler/dist/howler.min.js",
  "https://cdn.tailwindcss.com"
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(key => {
      if (key !== CACHE_NAME) return caches.delete(key);
    })))
  );
});

self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);
  if (PRECACHE_URLS.includes(requestUrl.pathname) || PRECACHE_URLS.includes(event.request.url)) {
    event.respondWith(
      caches.match(event.request).then(response => {
        return response || fetch(event.request).then(networkResponse => {
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        });
      })
    );
  } else {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
  }
});
