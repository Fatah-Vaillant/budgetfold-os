const CACHE = 'budgetfold-os-v2';
const CORE = ['./', './index.html', './style.css', './script.js', './manifest.json', './icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const sameOrigin = new URL(request.url).origin === self.location.origin;

  const fromNetwork = fetch(request).then((response) => {
    if (response && (response.ok || response.type === 'opaque')) {
      const copy = response.clone();
      caches.open(CACHE).then((cache) => cache.put(request, copy));
    }
    return response;
  });

  if (sameOrigin) {
    event.respondWith(
      fromNetwork.catch(() =>
        caches.match(request).then((hit) => hit || (request.mode === 'navigate' ? caches.match('./index.html') : Response.error()))
      )
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((hit) => {
      const refresh = fromNetwork.catch(() => hit);
      return hit || refresh;
    })
  );
});
