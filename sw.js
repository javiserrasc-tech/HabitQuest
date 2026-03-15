const CACHE_NAME = 'habitquest-v4';
const ASSETS = [
  '/manifest.json',
  'https://cdn-icons-png.flaticon.com/512/3050/3050212.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // index.html siempre desde la red, nunca desde caché
  if (event.request.url.endsWith('/') || event.request.url.includes('index.html')) {
    event.respondWith(fetch(event.request));
    return;
  }
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});
