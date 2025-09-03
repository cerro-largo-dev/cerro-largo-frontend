// src/components/MapComponent.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap, Popup, Marker } from 'react-leaflet';
import L from 'leaflet';

import combinedPolygonsUrl from '../assets/combined_polygons.geojson?url';

import { ROAD_VIS_THRESHOLD, getRoadStyle, onEachRoadFeature, REPORT_VIS_THRESHOLD } from '../utils/caminosUtils';

// ----------------- Iconos Leaflet por defecto -----------------
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Ícono GPS
const gpsIcon = new L.Icon({
  iconUrl:
    'data:image/svg+xml;base64,' +
    btoa(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#3b82f6" width="24" height="24">
        <circle cx="12" cy="12" r="8" fill="#3b82f6" stroke="#ffffff" stroke-width="2"/>
        <circle cx="12" cy="12" r="4" fill="#ffffff"/>
      </svg>
    `.trim()),
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -12],
  className: 'gps-marker-icon',
});

// --------- Ícono de ATENCIÓN ---------
const ICON_SIZE = 28;
const attentionIcon = L.divIcon({
  className: 'attention-pin',
  html: `
    <svg xmlns="http://www.w3.org/2000/svg" width="${ICON_SIZE}" height="${ICON_SIZE}" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3 L21 20 H3 Z" fill="#FDE68A" stroke="#F59E0B" stroke-opacity="0.5" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" />
      <rect x="11" y="8" width="2" height="7" rx="1" fill="#7C2D12" fill-opacity="0.8" />
      <circle cx="12" cy="16.5" r="1.2" fill="#7C2D12" fill-opacity="0.8" />
    </svg>
  `,
  iconSize: [ICON_SIZE, ICON_SIZE],
  iconAnchor: [ICON_SIZE / 2, ICON_SIZE - 2],
  popupAnchor: [0, -(ICON_SIZE - 8)],
});

// ----------------- Util estado/estilos -----------------
const stateColors = { green: '#22c55e', yellow: '#eab308', red: '#ef4444' };
const LOADING_FILL = '#e5e7eb';
const LOADING_STROKE = '#9ca3af';

const norm = (s = '') =>
  String(s)
    .toLowerCase()
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(/[\s\-_().,/]+/g, ''); // "Melo (GBA)" -> "melogba"

// ----------------- Zoom handler -----------------
function ZoomHandler({ onZoomChange }) {
  const map = useMap();
  useEffect(() => {
    const handleZoom = () => onZoomChange(map.getZoom());
    map.on('zoomend', handleZoom);
    onZoomChange(map.getZoom());
    return () => map.off('zoomend', handleZoom);
  }, [map, onZoomChange]);
  return null;
}

// ============================================================================
// Componente
// ============================================================================
function MapComponent({
  zoneStates,           // mapeo recibido desde App (plano o {states:{...}})
  onZoneStatesLoad,
  onZoneStateChange,
  onZonesLoad,
  userLocation,
  alerts = [],          // [{ id, lat, lng, titulo, descripcion }]
}) {
  const [combinedGeo, setCombinedGeo] = useState(null);

  // Caminería (carga diferida)
  const [roadsUrl, setRoadsUrl] = useState(null);        // URL del asset (tras import dinámico)
  const [caminosData, setCaminosData] = useState(null);  // GeoJSON ya parseado

  const [zones, setZones] = useState([]);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [currentZoom, setCurrentZoom] = useState(9);
  const mapRef = useRef(null);

  // flags/refs para reintentos de estados
  const hasStatesRef = useRef(false);
  const lastSuccessAtRef = useRef(0);
  const retryTimersRef = useRef([]);

  const statesLoadedProp = useMemo(
    () => zoneStates && Object.keys(zoneStates).length > 0,
    [zoneStates]
  );

  // Deriva un mapa normalizado: clave normalizada -> "green|yellow|red"
  const normalizedStates = useMemo(() => {
    const out = {};
    if (!zoneStates) return out;

    const base = zoneStates.states && typeof zoneStates.states === 'object'
      ? zoneStates.states
      : zoneStates;

    for (const [k, v] of Object.entries(base)) {
      const stateVal = typeof v === 'string' ? v : (v && v.state);
      if (!stateVal) continue;
      out[norm(k)] = String(stateVal).toLowerCase();
    }
    return out;
  }, [zoneStates]);

  // BACKEND_URL coherente con App
  const BACKEND_URL = useMemo(() => {
    const fromWin = (typeof window !== 'undefined' && window.BACKEND_URL) ? String(window.BACKEND_URL) : '';
    const envs =
      (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env.VITE_REACT_APP_BACKEND_URL || import.meta.env.VITE_BACKEND_URL)) ||
      (typeof process !== 'undefined' && process.env && (process.env.REACT_APP_BACKEND_URL || process.env.VITE_BACKEND_URL)) ||
      '';
    return (fromWin || envs || 'https://cerro-largo-backend.onrender.com').replace(/\/$/, '');
  }, []);

  const mapCenter = [-32.35, -54.20];
  const handleZoomChange = (z) => setCurrentZoom(z);

  // Helper: fetch JSON con timeout/backoff
  const fetchJsonRetry = useCallback(async (url, opts = {}, { retries = 2, baseDelay = 500, timeoutMs = 8000 } = {}) => {
    for (let i = 0; i <= retries; i++) {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), timeoutMs);
        const res = await fetch(url, { credentials: 'include', cache: 'no-store', mode: 'cors', signal: ctrl.signal, ...opts });
        clearTimeout(timer);
        const ct = res.headers.get('content-type') || '';
        if (!res.ok) throw new Error('HTTP ' + res.status);
        if (!ct.includes('application/json')) throw new Error('No-JSON');
        return await res.json();
      } catch (e) {
        if (i === retries) throw e;
        await new Promise(r => setTimeout(r, baseDelay * Math.pow(2, i)));
      }
    }
  }, []);

  const statesUrl = useCallback((noCache = false) => {
    return `${BACKEND_URL}/api/admin/zones/states${noCache ? `?__ts=${Date.now()}` : ''}`;
  }, [BACKEND_URL]);

  // Carga de estados (doble: normal y no-cache)
  const loadZoneStates = useCallback(async ({ forceNoCache = false } = {}) => {
    const url = statesUrl(!!forceNoCache);
    const data = await fetchJsonRetry(url);

    // Normalizar API -> mapa plano {name: "green|yellow|red"}
    const stateMap = {};
    if (data && typeof data === 'object') {
      const src = data.states && typeof data.states === 'object' ? data.states : data;
      for (const [zoneName, info] of Object.entries(src)) {
        const val = typeof info === 'string' ? info : (info && info.state);
        if (val) stateMap[zoneName] = String(val).toLowerCase();
      }
    }

    if (Object.keys(stateMap).length > 0) {
      hasStatesRef.current = true;
      lastSuccessAtRef.current = Date.now();
      onZoneStatesLoad && onZoneStatesLoad(stateMap);
    }
    return stateMap;
  }, [fetchJsonRetry, onZoneStatesLoad, statesUrl]);

  const hardReloadStates = useCallback(async () => {
    try { await loadZoneStates({ forceNoCache: false }); } catch {}
    try { await loadZoneStates({ forceNoCache: true  }); } catch {}
  }, [loadZoneStates]);

  // Exponer para debug manual
  useEffect(() => {
    if (typeof window !== 'undefined') (window).forceZoneStatesReload = hardReloadStates;
    return () => { if (typeof window !== 'undefined') delete (window).forceZoneStatesReload; };
  }, [hardReloadStates]);

  // Carga inicial: estados (prioridad) + polígonos
  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      // Estados primero (doble)
      await hardReloadStates();
      if (cancelled) return;

      // Reintentos si aún no hay estados
      if (!hasStatesRef.current) {
        const MAX_TRIES = 3;
        for (let i = 0; i < MAX_TRIES && !cancelled && !hasStatesRef.current; i++) {
          const delay = 600 * Math.pow(2, i);
          await new Promise(r => {
            const t = setTimeout(r, delay);
            retryTimersRef.current.push(t);
          });
          if (cancelled) return;
          try { await loadZoneStates({ forceNoCache: true }); } catch {}
        }
      }

      // Polígonos (siempre)
      try {
        const combinedRes = await fetch(combinedPolygonsUrl, { cache: 'no-store' });
        if (!combinedRes.ok) throw new Error('GeoJSON polígonos no disponible');

        const combinedJson = await combinedRes.json();
        if (cancelled) return;

        setCombinedGeo(combinedJson);

        // Listado de zonas
        const allZones = [];
        (combinedJson.features || []).forEach((f) => {
          const p = f.properties || {};
          if (p.municipio) allZones.push(p.municipio);
          else if (p.serie) allZones.push(`Melo (${p.serie})`);
        });
        setZones(allZones);
        onZonesLoad && onZonesLoad(allZones);
      } catch (err) {
        if (!cancelled) {
          console.error('Error cargando datos del mapa:', err);
          setMessage({ type: 'error', text: 'Error al cargar datos del mapa' });
        }
      }
    };

    start();
    return () => {
      cancelled = true;
      retryTimersRef.current.forEach(t => clearTimeout(t));
      retryTimersRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // LAZY-LOAD de caminería: importar URL y fetchear el JSON cuando el zoom supera el umbral
  useEffect(() => {
    let cancelled = false;

    const loadRoadsIfNeeded = async () => {
      if (currentZoom < ROAD_VIS_THRESHOLD) return; // aún no

      try {
        // 1) Import dinámico de la URL del asset (solo una vez)
        let url = roadsUrl;
        if (!url) {
          const mod = await import(/* @vite-ignore */ '../assets/camineria_cerro_largo.json?url');
          url = mod?.default;
          if (!url) throw new Error('URL de caminería no resuelta');
          if (!cancelled) setRoadsUrl(url);
        }

        // 2) Fetch + parse del GeoJSON (si aún no lo tenemos)
        if (!caminosData && url) {
          const res = await fetch(url, { cache: 'force-cache' });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const json = await res.json();
          if (!cancelled) setCaminosData(json);
        }
      } catch (e) {
        console.error('Lazy-load caminería:', e);
      }
    };

    loadRoadsIfNeeded();
    return () => { cancelled = true; };
  }, [currentZoom, roadsUrl, caminosData]);

  // Depuración: mostrar zonas del GeoJSON que no matchean contra el API
  useEffect(() => {
    if (!combinedGeo || !Object.keys(normalizedStates).length) return;
    const misses = new Set();
    for (const f of combinedGeo.features || []) {
      const p = f.properties || {};
     const mapSerieToName = (s) => (s === 'GEB' ? 'Mangrullo' : s === 'GCB' ? 'La Micaela' : `Melo (${s})`);
    const zoneName = p.municipio ? p.municipio : (p.serie ? mapSerieToName(p.serie) : '');
    }
    if (misses.size) console.debug('Zonas sin match de estado (normalizado):', Array.from(misses));
  }, [combinedGeo, normalizedStates]);

  // Estilo por estado usando nombres normalizados
  const getFeatureStyle = (feature) => {
    const p = feature.properties || {};
    const zoneName = p.municipio ? p.municipio : (p.serie ? `Melo (${p.serie})` : '');

    if (!Object.keys(normalizedStates).length && !statesLoadedProp) {
      return { fillColor: LOADING_FILL, weight: 1.5, opacity: 0.8, color: LOADING_STROKE, dashArray: '', fillOpacity: 0.25 };
    }

    const key = norm(zoneName);
    const stateKey = normalizedStates[key];
    const finalColor = stateColors[stateKey] || stateColors.green;

    return { fillColor: finalColor, weight: 2, opacity: 0.9, color: finalColor, dashArray: '', fillOpacity: 0.6 };
  };

  const getStateLabel = (state) =>
    state === 'green' ? 'Habilitado' : state === 'yellow' ? 'Precaución' : state === 'red' ? 'Cerrado' : 'Desconocido';

  const onEachFeature = (feature, layer) => {
    const p = feature.properties || {};
    const zoneName = p.municipio ? p.municipio : (p.serie ? `Melo (${p.serie})` : '');
    const nk = norm(zoneName);
    const stateKey = normalizedStates[nk];

    const department = p.depto || 'Cerro Largo';
    const area = p.area_km2 != null ? Number(p.area_km2).toFixed(2) : 'N/A';

    layer.bindPopup(
      `<b>${zoneName || 'Zona'}</b><br>` +
      `Departamento: ${department}<br>` +
      `Área: ${area} km²<br>` +
      `Estado: ${stateKey ? getStateLabel(stateKey) : 'Desconocido'}`
    );

    layer.on({
      mouseover: (e) => e.target.setStyle({ fillOpacity: 0.9 }),
      mouseout:  (e) => e.target.setStyle({ fillOpacity: 0.6 }),
    });
  };

  const showRoads = currentZoom >= ROAD_VIS_THRESHOLD && caminosData && (caminosData.features?.length || 0) > 0;
  const showReports = currentZoom >= REPORT_VIS_THRESHOLD;

  return (
    <div className="w-full h-full">
      {/* Mensajes */}
      {message.text && (
        <div
          className={`absolute z-[1001] left-1/2 -translate-x-1/2 top-4 px-3 py-2 rounded shadow text-white ${
            message.type === 'error' ? 'bg-red-600' : 'bg-green-600'
          }`}
        >
          {message.text}
          <button onClick={() => setMessage({ type: '', text: '' })} className="ml-2 text-sm">✕</button>
        </div>
      )}

      <MapContainer
        center={mapCenter}
        zoom={9}
        className="leaflet-container"
        style={{ width: '100%', height: '100%' }}
        whenCreated={(m) => (mapRef.current = m)}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Polígonos combinados (municipios + series) */}
        {combinedGeo && combinedGeo.features?.length > 0 && (
          <GeoJSON
            data={combinedGeo}
            style={getFeatureStyle}
            onEachFeature={onEachFeature}
            key={`combined-${JSON.stringify(normalizedStates)}`}
          />
        )}

        {/* Caminería (carga diferida y visible solo al acercar) */}
        {showRoads && (
          <GeoJSON
            data={caminosData}
            style={(f) => getRoadStyle(f, currentZoom)}
            onEachFeature={onEachRoadFeature}
            key={`caminos-layer-zoom-${currentZoom}`}
            pathOptions={{ interactive: true, bubblingMouseEvents: false }}
          />
        )}

        {/* Ubicación usuario */}
        {userLocation && (
          <Marker position={[userLocation.lat, userLocation.lng]} icon={gpsIcon}>
            <Popup>
              <div className="text-center">
                <strong>Tu ubicación actual</strong>
                <br />
                <small>
                  Lat: {userLocation.lat.toFixed(6)}
                  <br />
                  Lng: {userLocation.lng.toFixed(6)}
                </small>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Alertas visibles */}
        {showReports && Array.isArray(alerts) &&
          alerts.map((a) =>
            a && a.lat != null && a.lng != null ? (
              <Marker key={a.id || `${a.lat}-${a.lng}`} position={[a.lat, a.lng]} icon={attentionIcon}>
                <Popup>
                  <div className="text-sm">
                    <strong>{a.titulo || 'Atención'}</strong>
                    <br />
                    <small>{a.descripcion || ''}</small>
                  </div>
                </Popup>
              </Marker>
            ) : null
          )}

        <ZoomHandler onZoomChange={setCurrentZoom} />
      </MapContainer>
    </div>
  );
}

export default MapComponent;


