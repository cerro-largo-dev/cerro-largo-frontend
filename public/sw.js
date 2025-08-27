// Service Worker mejorado para cache de tiles OSM y APIs
// Mantiene la funcionalidad existente y añade cache de APIs

// --- Config para tiles OSM (existente) ---
const CACHE_OSM = 'osm-tiles-v2';
const MAX_ITEMS = 500;                           // límite de tiles en caché
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;      // frescura local: 30 días
const OSM_RE = /^https:\/\/([abc]\.)?tile\.openstreetmap\.org\/\d+\/\d+\/\d+\.png$/;

// --- Config para APIs y recursos estáticos (nuevo) ---
const CACHE_API = 'cerro-largo-api-v1';
const CACHE_STATIC = 'cerro-largo-static-v1';
const API_MAX_AGE = 60 * 5; // 5 minutos para APIs
const STATIC_MAX_AGE = 60 * 60 * 24; // 1 día para recursos estáticos

// Patrones de APIs para cachear
const API_PATTERNS = [
  /^https:\/\/cerro-largo-backend\.onrender\.com\/api\/zones\/states/,
  /^https:\/\/cerro-largo-backend\.onrender\.com\/api\/banner/,
  /\/assets\/.*\.geojson$/
];

// Recursos estáticos críticos
const CRITICAL_RESOURCES = [
  '/',
  '/src/main.jsx',
  '/src/App.jsx',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
];

self.addEventListener('install', (e) => {
  console.log('SW: Installing enhanced version...');
  e.waitUntil(
    caches.open(CACHE_STATIC)
      .then(cache => cache.addAll(CRITICAL_RESOURCES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  console.log('SW: Activating enhanced version...');
  e.waitUntil(self.clients.claim());
});

// ---- LRU simple (FIFO sobre cache.keys()) - existente ----
async function trimLRU(cache) {
  const keys = await cache.keys();
  if (keys.length <= MAX_ITEMS) return;
  await cache.delete(keys[0]);
  return trimLRU(cache);
}

// ---- Helpers de caché con timestamp - existente ----
async function putWithTimestamp(cache, request, response) {
  const headers = new Headers(response.headers);
  headers.set('x-sw-cache-time', Date.now().toString());

  const body = await response.clone().blob();
  const stamped = new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });

  await cache.put(request, stamped);
  if (cache === await caches.open(CACHE_OSM)) {
    trimLRU(cache).catch(() => {});
  }
}

function isFresh(resp, maxAge = MAX_AGE_SECONDS) {
  if (!resp) return false;
  const ts = resp.headers.get('x-sw-cache-time');
  if (!ts) return false;
  const age = (Date.now() - Number(ts)) / 1000;
  return age < maxAge;
}

async function fetchAndUpdate(cache, request) {
  try {
    const netResp = await fetch(request, { 
      cache: 'no-store', 
      credentials: 'omit', 
      mode: 'cors' 
    });
    if (netResp && netResp.ok) {
      await putWithTimestamp(cache, request, netResp.clone());
      return netResp;
    }
  } catch (_) {}
  return null;
}

// ---- Nuevo: Helper para APIs con stale-while-revalidate ----
async function handleApiRequest(request) {
  const cache = await caches.open(CACHE_API);
  const cached = await cache.match(request);
  
  // Stale-while-revalidate: devolver cache si existe, actualizar en background
  if (cached) {
    // Si está fresco, solo revalidar en background
    if (isFresh(cached, API_MAX_AGE)) {
      fetchAndUpdate(cache, request).catch(() => {});
      return cached;
    }
    
    // Si está stale, intentar red pero devolver cache como fallback
    const networkResponse = await fetchAndUpdate(cache, request);
    return networkResponse || cached;
  }
  
  // No hay cache, esperar red
  const networkResponse = await fetchAndUpdate(cache, request);
  return networkResponse || new Response('{}', { 
    status: 504, 
    statusText: 'API unavailable',
    headers: { 'Content-Type': 'application/json' }
  });
}

// ---- Nuevo: Helper para recursos estáticos ----
async function handleStaticRequest(request) {
  const cache = await caches.open(CACHE_STATIC);
  const cached = await cache.match(request);
  
  if (cached && isFresh(cached, STATIC_MAX_AGE)) {
    return cached;
  }
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      await putWithTimestamp(cache, request, networkResponse.clone());
      return networkResponse;
    }
  } catch (_) {}
  
  return cached || new Response('', { status: 404 });
}

// ---- Estrategia principal de fetch ----
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // 1) Tiles OSM - mantener lógica existente
  if (OSM_RE.test(req.url)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_OSM);
      const cached = await cache.match(req);

      // Si hay caché FRESCO → devuelve ya y revalida en bg
      if (isFresh(cached)) {
        event.waitUntil(fetchAndUpdate(cache, req));
        return cached;
      }

      // Si no hay o está vencido → intenta RED primero
      const net = await fetchAndUpdate(cache, req);
      if (net) return net;

      // Si la red falla, pero había algo (aunque viejo), devolvelo
      if (cached) return cached;

      // Último recurso: 504
      return new Response('', { status: 504, statusText: 'Tile unavailable' });
    })());
    return;
  }

  // 2) APIs - nueva funcionalidad
  if (API_PATTERNS.some(pattern => pattern.test(req.url))) {
    event.respondWith(handleApiRequest(req));
    return;
  }

  // 3) Recursos estáticos - nueva funcionalidad
  if (req.destination === 'script' || 
      req.destination === 'style' || 
      req.destination === 'document' ||
      req.url.includes('/src/') ||
      req.url.includes('/assets/')) {
    event.respondWith(handleStaticRequest(req));
    return;
  }

  // 4) Todo lo demás - pasar a la red
});

// ---- Limpieza de cache ----
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
      })
    );
  }
});

