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

export const parsePushPayload = (event) => {
  const fallback = { title: 'FF RESTaurent', body: '', url: '/' };
  if (!event.data) return fallback;
  try {
    const data = event.data.json();
    return {
      title: data.title ?? fallback.title,
      body: data.body ?? fallback.body,
      url: data.url ?? fallback.url,
    };
  } catch {
    return fallback;
  }
};

self.addEventListener('push', (event) => {
  const { title, body, url } = parsePushPayload(event);
  event.waitUntil(
    self.registration.showNotification(title, { body, data: { url } }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/';
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        const existing = clients.find((client) => client.url.includes(url));
        if (existing) return existing.focus();
        return self.clients.openWindow(url);
      }),
  );
});
