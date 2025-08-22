// src/components/MapComponent.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, GeoJSON, Popup, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// === GeoJSON ===
// Sugerencia: si podés, usa versiones simplificadas (min.geojson) para acelerar el primer pintado
import municipiosUrl from '../assets/cerro_largo_municipios_2025.geojson?url';
import meloSeriesUrl from '../assets/series_cerro_largo.geojson?url';
import caminosUrl from '../assets/camineria_cerro_largo.json?url';

// ====== Iconos Leaflet por defecto ======
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// ====== Iconos personalizados ======
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

// ====== Utilidades ======
const stateColors = { green: '#22c55e', yellow: '#eab308', red: '#ef4444' };

const supportsIdle = typeof window !== 'undefined' && 'requestIdleCallback' in window;
const rIC = (fn, timeout = 1000) =>
  supportsIdle ? window.requestIdleCallback(fn, { timeout }) : setTimeout(fn, 0);

// ====== Hook para escuchar zoom ======
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

export default function MapComponent({
  onZoneStatesLoad,      // callback(stateMap)
  initialCenter = [-32.35, -54.20],
  initialZoom = 9,
}) {
  // ====== Estado UI / datos ======
  const [loadingMsg, setLoadingMsg] = useState('Cargando mapa…');
  const [errorMsg, setErrorMsg] = useState('');
  const [zoom, setZoom] = useState(initialZoom);

  const [muniGeo, setMuniGeo] = useState(null);
  const [meloGeo, setMeloGeo] = useState(null);
  const [roadsGeo, setRoadsGeo] = useState(null);

  const [zoneStates, setZoneStates] = useState({});    // { "ARÉVALO": "green", ...}
  const [userLoc, setUserLoc] = useState(null);
  const [alertPoints, setAlertPoints] = useState([]);

  const mapRef = useRef(null);

  // ====== BACKEND_URL coherente con App.jsx ======
  const BACKEND_URL = useMemo(() => {
    const fromWin =
      (typeof window !== 'undefined' && window.BACKEND_URL) ? String(window.BACKEND_URL) : '';
    const envs =
      (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env.VITE_REACT_APP_BACKEND_URL || import.meta.env.VITE_BACKEND_URL)) ||
      (typeof process !== 'undefined' && process.env && (process.env.REACT_APP_BACKEND_URL || process.env.VITE_BACKEND_URL)) ||
      '';
    return (fromWin || envs || 'https://cerro-largo-backend.onrender.com').replace(/\/$/, '');
  }, []);

  // ====== Fetch robusto (timeout + retry + JSON check) ======
  const fetchJsonRetry = useCallback(async (url, opts = {}, { retries = 2, baseDelay = 400, timeoutMs = 8000 } = {}) => {
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

  // ====== FASE 1: polígonos + estados (colores) ======
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoadingMsg('Cargando polígonos…');

        // Cargar SOLO polígonos livianos en paralelo
        const [muni, melo] = await Promise.all([
          fetch(municipiosUrl).then(r => r.json()),
          fetch(meloSeriesUrl).then(r => r.json()),
        ]);
        if (!alive) return;
        setMuniGeo(muni);
        setMeloGeo(melo);

        // Estados de zonas desde backend (no bloquea admin ni nada extra)
        setLoadingMsg('Cargando estados…');
        const data = await fetchJsonRetry(`${BACKEND_URL}/api/admin/zones/states`);
        if (!alive) return;

        const map = {};
        if (data && typeof data === 'object') {
          if (data.states && typeof data.states === 'object') {
            for (const zone in data.states) {
              const v = data.states[zone];
              const raw = typeof v === 'string' ? v : (v && v.state);
              map[zone] = String(raw || '').toLowerCase();
            }
          } else {
            for (const k of Object.keys(data)) map[k] = String(data[k] || '').toLowerCase();
          }
        }
        setZoneStates(map);
        onZoneStatesLoad && onZoneStatesLoad(map);

        // Ya tenemos COLORES en pantalla → limpiamos mensaje
        setLoadingMsg('');
      } catch (err) {
        if (!alive) return;
        console.error(err);
        setErrorMsg('No se pudo cargar el mapa inicial.');
        setLoadingMsg('');
      }
    })();
    return () => { alive = false; };
  }, [BACKEND_URL, fetchJsonRetry, onZoneStatesLoad]);

  // ====== FASE 2: caminería (pesada) — diferida por zoom/idle ======
  useEffect(() => {
    if (roadsGeo) return; // ya cargada

    const tryLoad = () => {
      if (roadsGeo) return;
      const z = mapRef.current?.getZoom?.() ?? zoom;
      if (z >= 10) {
        fetch(caminosUrl)
          .then(r => r.json())
          .then(json => setRoadsGeo(json))
          .catch(() => {});
      } else {
        // Intento “en idle” sin bloquear UI
        rIC(() => {
          if (!roadsGeo) {
            fetch(caminosUrl)
              .then(r => r.json())
              .then(json => setRoadsGeo(json))
              .catch(() => {});
          }
        }, 1200);
      }
    };

    // Intento inicial
    tryLoad();

    // Reintento al cambiar zoom
    const h = () => tryLoad();
    mapRef.current?.on?.('zoomend', h);
    return () => mapRef.current?.off?.('zoomend', h);
  }, [roadsGeo, zoom]);

  // ====== FASE 3: geolocalización — después de pintar capas ======
  useEffect(() => {
    if (userLoc) return;
    const id = rIC(() => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {}, // silencioso si el usuario niega permisos
        { enableHighAccuracy: false, maximumAge: 30000, timeout: 3000 }
      );
    }, 800);
    return () => (supportsIdle ? window.cancelIdleCallback?.(id) : clearTimeout(id));
  }, [userLoc]);

  // ====== FASE 4: alertas — última prioridad ======
  useEffect(() => {
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
      } catch {
        // no bloqueamos por alertas
      }
    }, 1200);
    return () => { alive = false; supportsIdle ? window.cancelIdleCallback?.(id) : clearTimeout(id); };
  }, [BACKEND_URL, fetchJsonRetry]);

  // ====== Refresco cuando AdminPanel emite cambio ======
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
        setZoneStates(map);
        onZoneStatesLoad && onZoneStatesLoad(map);
      } catch {}
    };
    window.addEventListener('zoneStateUpdated', h);
    return () => window.removeEventListener('zoneStateUpdated', h);
  }, [BACKEND_URL, fetchJsonRetry, onZoneStatesLoad]);

  // ====== Estilos / popups ======
  const stateLabel = (s) => (s === 'yellow' ? 'Alerta' : s === 'red' ? 'Suspendido' : 'Habilitado');

  const styleFeature = (feature) => {
    let name;
    if (feature.properties?.municipio) name = feature.properties.municipio;
    else if (feature.properties?.serie) name = `Melo (${feature.properties.serie})`;
    const st = zoneStates[name] || 'green';
    const color = stateColors[st] || stateColors.green;
    return { fillColor: color, color, weight: 2, opacity: 0.9, fillOpacity: 0.6 };
  };

  const onEachFeature = (feature, layer) => {
    let name;
    if (feature.properties?.municipio) name = feature.properties.municipio;
    else if (feature.properties?.serie) name = `Melo (${feature.properties.serie})`;
    const st = stateLabel(zoneStates[name] || 'green');
    layer.bindPopup(`<b>${name}</b><br/>Estado: ${st}`);
    layer.on({
      mouseover: (e) => e.target.setStyle({ fillOpacity: 0.9 }),
      mouseout: (e) => e.target.setStyle({ fillOpacity: 0.6 }),
    });
  };

  return (
    <div style={{ position: 'relative' }}>
      {/* Estado mínimo y no bloqueante */}
      {loadingMsg && <div style={styles.bannerInfo}>{loadingMsg}</div>}
      {errorMsg &&   <div style={styles.bannerError}>{errorMsg}</div>}

      <MapContainer
        whenCreated={(m) => (mapRef.current = m)}
        center={initialCenter}
        zoom={initialZoom}
        style={{ width: '100%', height: '100vh' }}
        preferCanvas
      >
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* FASE 1: polígonos + colores */}
        {muniGeo  && <GeoJSON data={muniGeo}  style={styleFeature} onEachFeature={onEachFeature} />}
        {meloGeo  && <GeoJSON data={meloGeo}  style={styleFeature} onEachFeature={onEachFeature} />}

        {/* FASE 2: caminería (pesada) diferida */}
        {roadsGeo && (
          <GeoJSON
            data={roadsGeo}
            style={() => ({ color: '#334155', weight: Math.max(1, (zoom - 8) * 0.8), opacity: 0.8 })}
            onEachFeature={(f, layer) => {
              if (f.properties?.nombre) layer.bindPopup(`<b>${f.properties.nombre}</b>`);
            }}
            pathOptions={{ interactive: true, bubblingMouseEvents: false }}
          />
        )}

        {/* FASE 3: geolocalización diferida */}
        {userLoc && (
          <Marker position={[userLoc.lat, userLoc.lng]} icon={gpsIcon}>
            <Popup>Tu ubicación</Popup>
          </Marker>
        )}

        {/* FASE 4: alertas diferidas */}
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

const styles = {
  bannerInfo: {
    position: 'absolute', zIndex: 1000, top: 10, left: 10,
    background: '#ffffff', border: '1px solid #d1d5db',
    padding: '8px 12px', borderRadius: 8, boxShadow: '0 2px 10px rgba(0,0,0,0.08)', fontSize: 14,
  },
  bannerError: {
    position: 'absolute', zIndex: 1000, top: 10, left: 10,
    background: '#fee2e2', color: '#7f1d1d',
    border: '1px solid #fecaca', padding: '8px 12px',
    borderRadius: 8, boxShadow: '0 2px 10px rgba(0,0,0,0.08)', fontSize: 14,
  },
};
