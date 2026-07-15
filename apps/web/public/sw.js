const CACHE_NAME = 'ff-restaurent-static-v1.1';
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/manifest.webmanifest',
];
const STATIC_DESTINATIONS = new Set(['script', 'style', 'image', 'font']);

export const cacheStrategyFor = (request, origin = self.location.origin) => {
  if (request.method !== 'GET' || new URL(request.url).origin !== origin) {
    return 'network-only';
  }
  if (request.mode === 'navigate') return 'navigation';
  if (STATIC_DESTINATIONS.has(request.destination)) return 'static';
  return 'network-only';
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

const navigationResponse = async (request) => {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put('/index.html', response.clone());
    }
    return response;
  } catch {
    return (await caches.match('/index.html')) ?? Response.error();
  }
};

const staticResponse = async (request) => {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && response.type !== 'opaque') {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }
  return response;
};

self.addEventListener('fetch', (event) => {
  const strategy = cacheStrategyFor(event.request);
  if (strategy === 'navigation') {
    event.respondWith(navigationResponse(event.request));
  } else if (strategy === 'static') {
    event.respondWith(staticResponse(event.request));
  }
});
