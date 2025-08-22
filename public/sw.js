// --- Config ---
const CACHE_OSM = 'osm-tiles-v1';
const MAX_ITEMS = 500; // ajusta según tu uso
const OSM_RE = /https:\/\/[abc]\.tile\.openstreetmap\.org\/\d+\/\d+\/\d+\.png$/;

self.addEventListener('install', (e) => self.skipWaiting());
self.addEventListener('activate', (e) => self.clients.claim());

// LRU simple
async function trimLRU(cache) {
  const keys = await cache.keys();
  if (keys.length <= MAX_ITEMS) return;
  await cache.delete(keys[0]);
  return trimLRU(cache);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || !OSM_RE.test(req.url)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_OSM);
    const hit = await cache.match(req);

    if (hit) {
      // Stale-While-Revalidate
      event.waitUntil(
        fetch(req, { cache: 'no-store' })
          .then(async (resp) => { await cache.put(req, resp.clone()); await trimLRU(cache); })
          .catch(() => {})
      );
      return hit;
    }

    try {
      const resp = await fetch(req, { cache: 'no-store' });
      await cache.put(req, resp.clone());
      await trimLRU(cache);
      return resp;
    } catch {
      return new Response('', { status: 504, statusText: 'Tile unavailable' });
    }
  })());
});
