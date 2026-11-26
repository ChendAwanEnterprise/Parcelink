const CACHE = 'parcelink-v10';
const PRECACHE = [
  './index.html',
  './css/style.css',
  './config.js',
  './js/common.js',
  './js/home.js',
  './icons/icon-192.png',
  './manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function fromNetwork(request) {
  return fetch(request).then((response) => {
    if (response.ok) {
      const copy = response.clone();
      caches.open(CACHE).then((cache) => cache.put(request, copy));
    }
    return response;
  });
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  const staticFile = /\.(?:css|js|png|webmanifest)$/.test(url.pathname);
  if (staticFile) {
    event.respondWith(caches.match(event.request).then((cached) => {
      const network = fromNetwork(event.request).catch(() => cached);
      return cached || network;
    }));
    return;
  }
  event.respondWith(
    fromNetwork(event.request).catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html')))
  );
});
