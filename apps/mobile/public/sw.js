const CACHE_NAME = 'jixiang-media-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Only cache immutable Vite-hashed assets and immutable uploaded dish images.
  // Never intercept index.html, sw.js, or JSON API endpoints so hot updates remain instant.
  const isImmutableMedia =
    url.pathname.startsWith('/assets/') || url.pathname.startsWith('/api/v1/images/');
  if (!isImmutableMedia) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(req);
      if (cached) return cached;

      const response = await fetch(req);
      if (response && response.ok && response.type === 'basic') {
        cache.put(req, response.clone()).catch(() => {});
      }
      return response;
    }),
  );
});
