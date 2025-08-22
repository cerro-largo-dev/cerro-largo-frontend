// src/components/MapComponent.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap, Popup, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Archivos TopoJSON SERVIDOS desde /public/data (no usar imports con ?url)
const POLY_URL = '/data/combined_polygons.topojson';
const CAMINOS_URL = '/data/camineria_cerro_largo.topojson';

// ================== Iconos Leaflet por defecto ==================
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Ícono GPS (SVG)
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

// Ícono de alerta
const attentionIcon = L.divIcon({
  className: 'attention-pin',
  html: `
    <svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 24 24">
      <g>
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" fill="#000000"/>
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
              fill="#F59E0B" transform="scale(0.9) translate(1.3,1.3)"/>
        <rect x="11" y="8" width="2" height="6" rx="1" fill="#111827"/>
        <circle cx="12" cy="16.5" r="1.2" fill="#111827"/>
      </g>
    </svg>
  `,
  iconSize: [34, 34],
  iconAnchor: [17, 30],
  popupAnchor: [0, -26],
});

// ================== Constantes / helpers ==================
const stateColors = { green: '#22c55e', yellow: '#eab308', red: '#ef4444' };
const supportsIdle = typeof window !== 'undefined' && 'requestIdleCallback' in window;
const rIC = (fn, timeout = 1000) =>
  supportsIdle ? window.requestIdleCallback(fn, { timeout }) : setTimeout(fn, 0);

function ZoomHandler({ onZoomChange }) {
  const map = useMap();
  useEffect(() => {
    const h = () => onZoomChange(map.getZoom());
    map.on('zoomend', h);
    onZoomChange(map.getZoom());
    return () => map.off('zoomend', h);
  }, [map, onZoomChange]);
  return null;
}

// Estilo básico para caminería (si tenías utils externas, podés reemplazar estos helpers)
function getRoadStyle(_feature, zoom) {
  return {
    color: '#334155',
    weight: Math.max(1, (zoom - 8) * 0.8),
    opacity: 0.8,
  };
}
function onEachRoadFeature(f, layer) {
  const name = f?.properties?.nombre || f?.properties?.name;
  if (name) layer.bindPopup(`<b>${name}</b>`);
}

export default function MapComponent({
  zoneStates: zoneStatesProp = {},      // opcional: estados que vengan de App
  onZoneStatesLoad,                     // callback(map)
  onZonesLoad,                          // callback(array)
  alerts: alertsProp,                   // marcadores externos opcionales
}) {
  // ===== Estado interno =====
  const [loadingMsg, setLoadingMsg] = useState('Cargando mapa…');
  const [errorMsg, setErrorMsg] = useState('');
  const [zoom, setZoom] = useState(9);

  const [polygonsData, setPolygonsData] = useState(null); // GeoJSON
  const [roadsData, setRoadsData] = useState(null);       // GeoJSON

  const [zones, setZones] = useState([]);
  const [zoneStatesInternal, setZoneStatesInternal] = useState({});
  const displayStates = useMemo(
    () => ({ ...zoneStatesInternal, ...zoneStatesProp }),
    [zoneStatesInternal, zoneStatesProp]
  );

  const [userLoc, setUserLoc] = useState(null);
  const [alertPoints, setAlertPoints] = useState([]);

  const mapRef = useRef(null);

  // ===== BACKEND_URL coherente con App.jsx =====
  const BACKEND_URL = useMemo(() => {
    const fromWin = typeof window !== 'undefined' && window.BACKEND_URL ? String(window.BACKEND_URL) : '';
    const envs =
      (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env.VITE_REACT_APP_BACKEND_URL || import.meta.env.VITE_BACKEND_URL)) ||
      (typeof process !== 'undefined' && process.env && (process.env.REACT_APP_BACKEND_URL || process.env.VITE_BACKEND_URL)) ||
      '';
    return (fromWin || envs || 'https://cerro-largo-backend.onrender.com').replace(/\/$/, '');
  }, []);

  // ===== Fetch helpers =====
  // Nuestros .topojson son “simples”: contienen un FeatureCollection en topo.objects[<clave>]
  const fetchTopoSimple = useCallback(async (url) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const topo = await res.json();
    const objects = topo?.objects || {};
    const firstKey = Object.keys(objects)[0];
    const first = objects[firstKey];
    if (first?.type === 'FeatureCollection' && Array.isArray(first.features)) return first;
    if (first?.type === 'Feature') return { type: 'FeatureCollection', features: [first] };
    if (topo?.type === 'FeatureCollection') return topo; // por si vino GeoJSON plano
    throw new Error('TopoJSON inesperado');
  }, []);

  const fetchJsonRetry = useCallback(async (url, opts = {}, { retries = 2, baseDelay = 400, timeoutMs = 8000 } = {}) => {
    for (let i = 0; i <= retries; i++) {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), timeoutMs);
        const res = await fetch(url, { credentials: 'include', cache: 'no-store', mode: 'cors', signal: ctrl.signal, ...opts });
        clearTimeout(t);
        const ct = res.headers.get('content-type') || '';
        if (!res.ok) throw new Error('HTTP ' + res.status);
        if (!ct.includes('application/json')) throw new Error('No-JSON');
        return await res.json();
      } catch (e) {
        if (i === retries) throw e;
        await new Promise(r => setTimeout(r, baseDelay * 2 ** i));
      }
    }
  }, []);

  // ===== FASE 1: Polígonos + estados =====
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoadingMsg('Cargando polígonos…');
        const polyGeo = await fetchTopoSimple(POLY_URL);
        if (!alive) return;
        setPolygonsData(polyGeo);

        // Zonas
        const allZones = [];
        polyGeo.features.forEach((f) => {
          if (f.properties?.municipio) allZones.push(f.properties.municipio);
          else if (f.properties?.serie) allZones.push(`Melo (${f.properties.serie})`);
        });
        setZones(allZones);
        onZonesLoad && onZonesLoad(allZones);

        // Estados
        setLoadingMsg('Cargando estados…');
        const data = await fetchJsonRetry(`${BACKEND_URL}/api/admin/zones/states`);
        if (!alive) return;
        const map = {};
        if (data?.states && typeof data.states === 'object') {
          for (const zone in data.states) {
            const v = data.states[zone];
            const raw = typeof v === 'string' ? v : (v && v.state);
            map[zone] = String(raw || '').toLowerCase();
          }
        } else if (data && typeof data === 'object') {
          for (const k of Object.keys(data)) map[k] = String(data[k] || '').toLowerCase();
        }
        setZoneStatesInternal(map);
        onZoneStatesLoad && onZoneStatesLoad(map);

        setLoadingMsg('');
      } catch (err) {
        if (!alive) return;
        console.error(err);
        setErrorMsg('No se pudo cargar el mapa inicial.');
        setLoadingMsg('');
      }
    })();
    return () => { alive = false; };
  }, [BACKEND_URL, fetchJsonRetry, fetchTopoSimple, onZonesLoad, onZoneStatesLoad]);

  // ===== FASE 2: Caminería (diferida por zoom/idle) =====
  useEffect(() => {
    if (roadsData) return;

    const tryLoad = () => {
      if (roadsData) return;
      const z = mapRef.current?.getZoom?.() ?? zoom;
      if (z >= 10) {
        fetchTopoSimple(CAMINOS_URL).then(setRoadsData).catch(() => {});
      } else {
        rIC(() => { if (!roadsData) fetchTopoSimple(CAMINOS_URL).then(setRoadsData).catch(() => {}); }, 1200);
      }
    };

    tryLoad();
    const h = () => tryLoad();
    mapRef.current?.on?.('zoomend', h);
    return () => mapRef.current?.off?.('zoomend', h);
  }, [roadsData, zoom, fetchTopoSimple]);

  // ===== FASE 3: Geolocalización (diferida) =====
  useEffect(() => {
    if (userLoc) return;
    const id = rIC(() => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {},
        { enableHighAccuracy: false, maximumAge: 30000, timeout: 3000 }
      );
    }, 800);
    return () => (supportsIdle ? window.cancelIdleCallback?.(id) : clearTimeout(id));
  }, [userLoc]);

  // ===== FASE 4: Alertas (INUMET) si no vienen por props =====
  useEffect(() => {
    if (alertsProp && Array.isArray(alertsProp)) {
      setAlertPoints(alertsProp);
      return;
    }
    let alive = true;
    const id = rIC(async () => {
      try {
        const data = await fetchJsonRetry(`${BACKEND_URL}/api/inumet/alerts/cerro-largo`);
        if (!alive) return;
        const pts = [];
        if (Array.isArray(data?.features)) {
          data.features.forEach((f, idx) => {
            const c = f.geometry?.coordinates;
            if (Array.isArray(c) && c.length >= 2) {
              pts.push({
                id: f.id || idx,
                lat: c[1],
                lng: c[0],
                titulo: f.properties?.headline || 'Alerta',
                descripcion: f.properties?.description || '',
              });
            }
          });
        }
        setAlertPoints(pts);
      } catch {}
    }, 1200);
    return () => { alive = false; supportsIdle ? window.cancelIdleCallback?.(id) : clearTimeout(id); };
  }, [alertsProp, BACKEND_URL, fetchJsonRetry]);

  // ===== Escuchar cambios desde Admin =====
  useEffect(() => {
    const h = async () => {
      try {
        const data = await fetchJsonRetry(`${BACKEND_URL}/api/admin/zones/states`);
        const map = {};
        if (data?.states && typeof data.states === 'object') {
          for (const zone in data.states) {
            const v = data.states[zone];
            const raw = typeof v === 'string' ? v : (v && v.state);
            map[zone] = String(raw || '').toLowerCase();
          }
        } else if (data && typeof data === 'object') {
          for (const k of Object.keys(data)) map[k] = String(data[k] || '').toLowerCase();
        }
        setZoneStatesInternal(map);
        onZoneStatesLoad && onZoneStatesLoad(map);
      } catch {}
    };
    window.addEventListener('zoneStateUpdated', h);
    return () => window.removeEventListener('zoneStateUpdated', h);
  }, [BACKEND_URL, fetchJsonRetry, onZoneStatesLoad]);

  // ===== Estilo y popups =====
  const stateLabel = (s) => (s === 'yellow' ? 'Alerta' : s === 'red' ? 'Suspendido' : 'Habilitado');
  const styleFeature = (feature) => {
    let name;
    if (feature.properties?.municipio) name = feature.properties.municipio;
    else if (feature.properties?.serie) name = `Melo (${feature.properties.serie})`;
    const st = displayStates[name] || 'green';
    const color = stateColors[st] || stateColors.green;
    return { fillColor: color, color, weight: 2, opacity: 0.9, fillOpacity: 0.6 };
  };
  const onEachFeature = (feature, layer) => {
    let name;
    if (feature.properties?.municipio) name = feature.properties.municipio;
    else if (feature.properties?.serie) name = `Melo (${feature.properties.serie})`;
    const st = stateLabel(displayStates[name] || 'green');
    layer.bindPopup(`<b>${name}</b><br/>Estado: ${st}`);
    layer.on({
      mouseover: (e) => e.target.setStyle({ fillOpacity: 0.9 }),
      mouseout: (e) => e.target.setStyle({ fillOpacity: 0.6 }),
    });
  };

  // key que fuerza remount cuando cambian estados → re-estila colores
  const polysKey = useMemo(
    () => `polys-${Object.keys(displayStates).sort().map(k => `${k}:${displayStates[k]}`).join('|')}`,
    [displayStates]
  );

  return (
    <div className="relative w-full h-screen">
      {loadingMsg && (
        <div className="absolute top-4 left-4 z-[1000] p-3 rounded-lg bg-white border border-gray-300 shadow">
          {loadingMsg}
        </div>
      )}
      {errorMsg && (
        <div className="absolute top-4 left-4 z-[1000] p-3 rounded-lg bg-red-100 text-red-800 border border-red-300 shadow">
          {errorMsg}
        </div>
      )}

      <MapContainer
        whenCreated={(m) => (mapRef.current = m)}
        center={[-32.35, -54.2]}
        zoom={9}
        style={{ width: '100%', height: '100vh' }}
        preferCanvas
      >
        <TileLayer
          attribution="&copy; OpenStreetMap"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* FASE 1: polígonos + colores */}
        {polygonsData && (
          <GeoJSON
            key={polysKey}
            data={polygonsData}
            style={styleFeature}
            onEachFeature={onEachFeature}
          />
        )}

        {/* FASE 2: caminería (diferida) */}
        {roadsData && (
          <GeoJSON
            data={roadsData}
            style={(f) => getRoadStyle(f, zoom)}
            onEachFeature={onEachRoadFeature}
            pathOptions={{ interactive: true, bubblingMouseEvents: false }}
          />
        )}

        {/* FASE 3: geolocalización */}
        {userLoc && (
          <Marker position={[userLoc.lat, userLoc.lng]} icon={gpsIcon}>
            <Popup>Tu ubicación</Popup>
          </Marker>
        )}

        {/* FASE 4: alertas */}
        {alertPoints.map((a) => (
          <Marker key={`alert-${a.id}`} position={[a.lat, a.lng]} icon={attentionIcon}>
            <Popup>
              <div style={{ minWidth: 180 }}>
                <strong>{a.titulo || 'Alerta'}</strong><br />
                <small>{a.descripcion || ''}</small>
              </div>
            </Popup>
          </Marker>
        ))}

        <ZoomHandler onZoomChange={setZoom} />
      </MapContainer>
    </div>
  );
}
