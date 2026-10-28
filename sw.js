// Service worker : app hors ligne. Une nouvelle version attend que l'utilisateur choisisse « Mettre à jour ».
const CACHE = 'budgetfold-os-1.0.0';
const CORE = ['./', './index.html', './style.css', './js/util.mjs', './js/data.mjs', './js/engine.mjs', './js/io.mjs', './js/ui.mjs', './js/main.mjs', './manifest.json', './icon.svg', './icon-192.png', './icon-512.png', './icon-180.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)));
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
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
