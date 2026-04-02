// Легенда PWA Service Worker v2
const STATIC = 'legenda-static-v2';
const IMAGES = 'legenda-images-v2';

const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(STATIC)
      .then(c => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('SW install error:', err))
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== STATIC && k !== IMAGES).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // CDN images — cache first
  if (url.hostname.includes('tildacdn.com') || url.hostname.includes('fonts.gstatic.com')) {
    e.respondWith(cacheFirst(e.request, IMAGES));
    return;
  }

  // Google Fonts CSS — cache first
  if (url.hostname.includes('fonts.googleapis.com')) {
    e.respondWith(cacheFirst(e.request, STATIC));
    return;
  }

  // Navigation — network first, fallback to cache
  if (e.request.mode === 'navigate') {
    e.respondWith(networkFirst(e.request));
    return;
  }

  // Everything else — stale while revalidate
  e.respondWith(staleWhileRevalidate(e.request));
});

async function cacheFirst(req, name = STATIC) {
  const hit = await caches.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res.ok) (await caches.open(name)).put(req, res.clone());
    return res;
  } catch { return new Response('Offline', { status: 503 }); }
}

async function networkFirst(req) {
  try {
    const res = await fetch(req);
    const cache = await caches.open(STATIC);
    cache.put(req, res.clone());
    return res;
  } catch {
    return (await caches.match(req)) || (await caches.match('./index.html'));
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(req);
  const fresh = fetch(req).then(res => {
    if (res.ok) cache.put(req, res.clone());
    return res;
  }).catch(() => null);
  return hit || fresh;
}
