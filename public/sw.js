// --- Config ---
const CACHE_OSM = 'osm-tiles-v2';
const MAX_ITEMS = 500;                           // límite de tiles en caché
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;      // frescura local: 30 días
const OSM_RE = /^https:\/\/([abc]\.)?tile\.openstreetmap\.org\/\d+\/\d+\/\d+\.png$/;

self.addEventListener('install', (e) => self.skipWaiting());
self.addEventListener('activate', (e) => self.clients.claim());

// ---- LRU simple (FIFO sobre cache.keys()) ----
async function trimLRU(cache) {
  const keys = await cache.keys();
  if (keys.length <= MAX_ITEMS) return;
  await cache.delete(keys[0]);
  return trimLRU(cache);
}

// ---- Helpers de caché con timestamp ----
async function putWithTimestamp(cache, request, response) {
  // Guardamos un timestamp en headers para calcular “edad” local
  const headers = new Headers(response.headers);
  headers.set('x-sw-cache-time', Date.now().toString());

  const body = await response.clone().blob();
  const stamped = new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });

  await cache.put(request, stamped);
  trimLRU(cache).catch(() => {});
}

function isFresh(resp) {
  if (!resp) return false;
  const ts = resp.headers.get('x-sw-cache-time');
  if (!ts) return false;
  const age = (Date.now() - Number(ts)) / 1000;
  return age < MAX_AGE_SECONDS;
}

async function fetchAndUpdate(cache, request) {
  try {
    const netResp = await fetch(request, { cache: 'no-store', credentials: 'omit', mode: 'cors' });
    if (netResp && netResp.ok) {
      await putWithTimestamp(cache, request, netResp.clone());
      return netResp;
    }
  } catch (_) {}
  return null;
}

// ---- Estrategia: cache-first con SWR + TTL ----
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || !OSM_RE.test(req.url)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_OSM);
    const cached = await cache.match(req);

    // 1) Si hay caché FRESCO → devuelve ya y revalida en bg
    if (isFresh(cached)) {
      event.waitUntil(fetchAndUpdate(cache, req));
      return cached;
    }

    // 2) Si no hay o está vencido → intenta RED primero
    const net = await fetchAndUpdate(cache, req);
    if (net) return net;

    // 3) Si la red falla, pero había algo (aunque viejo), devolvelo
    if (cached) return cached;

    // 4) Último recurso: 504
    return new Response('', { status: 504, statusText: 'Tile unavailable' });
  })());
});
