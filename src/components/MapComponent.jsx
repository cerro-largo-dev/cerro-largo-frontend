// src/components/MapComponent.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap, Popup, Marker } from 'react-leaflet';
import L from 'leaflet';

// 👉 Un solo archivo combinado
import combinedPolygonsUrl from '../assets/combined_polygons.geojson?url';
import caminosDataUrl from '../assets/camineria_cerro_largo.json?url';
import { getRoadStyle, onEachRoadFeature } from '../utils/caminosUtils';

// Configurar iconos de Leaflet (por defecto)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Ícono GPS (SVG)
const gpsIcon = new L.Icon({
  iconUrl:
    'data:image/svg+xml;base64,' +
    btoa(
      `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#3b82f6" width="24" height="24">
          <circle cx="12" cy="12" r="8" fill="#3b82f6" stroke="#ffffff" stroke-width="2"/>
          <circle cx="12" cy="12" r="4" fill="#ffffff"/>
        </svg>
      `.trim()
    ),
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -12],
  className: 'gps-marker-icon',
});

// Ícono de ATENCIÓN estilo Waze (triángulo amarillo con signo)
const attentionIcon = L.divIcon({
  className: 'attention-pin',
  html: `
    <svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 24 24">
      <defs>
        <filter id="shadow"><feDropShadow dx="0" dy="1" stdDeviation="1" flood-opacity="0.3"/></filter>
      </defs>
      <g filter="url(#shadow)">
        <path d="M12 2 L22 20 H2 Z" fill="#fbbf24" stroke="#111827" stroke-width="1.5"/>
        <rect x="11" y="8" width="2" height="6" rx="1" fill="#111827"/>
        <circle cx="12" cy="16.5" r="1.2" fill="#111827"/>
      </g>
    </svg>
  `,
  iconSize: [34, 34],
  iconAnchor: [17, 30],
  popupAnchor: [0, -26],
});

// Colores para estados
const stateColors = { green: '#22c55e', yellow: '#eab308', red: '#ef4444' };

// Placeholder mientras se cargan estados
const LOADING_FILL = '#e5e7eb';
const LOADING_STROKE = '#9ca3af';

// Manejar eventos de zoom
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

function MapComponent({
  zoneStates,
  onZoneStatesLoad,
  onZoneStateChange,
  onZonesLoad,
  userLocation,
  alerts = [], // [{ id, lat, lng, titulo, descripcion }]
}) {
  const [combinedGeo, setCombinedGeo] = useState(null);
  const [caminosData, setCaminosData] = useState(null);
  const [zones, setZones] = useState([]);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [currentZoom, setCurrentZoom] = useState(9);
  const mapRef = useRef(null);

  const statesLoaded = useMemo(
    () => zoneStates && Object.keys(zoneStates).length > 0,
    [zoneStates]
  );

  // BACKEND_URL coherente con App.jsx
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

  // Helper: fetch JSON con timeout y backoff
  const fetchJsonRetry = useCallback(async (url, opts = {}, { retries = 3, baseDelay = 500, timeoutMs = 8000 } = {}) => {
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

  // Carga: estados + GeoJSON combinado + caminería
  useEffect(() => {
    const loadData = async () => {
      try {
        const statesP = loadZoneStates();

        const [combinedRes, caminosRes] = await Promise.all([
          fetch(combinedPolygonsUrl, { cache: 'no-store' }),
          fetch(caminosDataUrl, { cache: 'no-store' }),
        ]);

        if (!(combinedRes.ok && caminosRes.ok)) throw new Error('GeoJSON assets no disponibles');

        const [combinedJson, caminosJson] = await Promise.all([
          combinedRes.json(),
          caminosRes.json(),
        ]);

        setCombinedGeo(combinedJson);
        setCaminosData(caminosJson);

        // Construir listado de zonas con el esquema previo:
        // - Municipios: properties.municipio
        // - Series Melo: properties.serie  => "Melo (X)"
        const allZones = [];
        (combinedJson.features || []).forEach((f) => {
          const p = f.properties || {};
          if (p.municipio) allZones.push(p.municipio);
          else if (p.serie) allZones.push(`Melo (${p.serie})`);
        });
        setZones(allZones);
        onZonesLoad && onZonesLoad(allZones);

        await statesP;
      } catch (error) {
        console.error('Error cargando datos del mapa:', error);
        setMessage({ type: 'error', text: 'Error al cargar datos del mapa' });
      }
    };
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadZoneStates = useCallback(async () => {
    try {
      const data = await fetchJsonRetry(`${BACKEND_URL}/api/admin/zones/states`);
      const stateMap = {};
      if (data && typeof data === 'object') {
        if (data.states && typeof data.states === 'object') {
          for (const zoneName in data.states) {
            const v = data.states[zoneName];
            const raw = typeof v === 'string' ? v : (v && v.state);
            stateMap[zoneName] = String(raw || '').toLowerCase();
          }
        } else {
          for (const k of Object.keys(data)) stateMap[k] = String(data[k] || '').toLowerCase();
        }
      }
      onZoneStatesLoad && onZoneStatesLoad(stateMap);
    } catch (error) {
      console.error('Error loading zone states:', error);
      setMessage({ type: 'error', text: 'Error al cargar estados de zonas' });
    }
  }, [BACKEND_URL, fetchJsonRetry, onZoneStatesLoad]);

  // Listener para refrescar estados
  useEffect(() => {
    const handler = () => loadZoneStates();
    window.addEventListener('zoneStateUpdated', handler);
    return () => window.removeEventListener('zoneStateUpdated', handler);
  }, [loadZoneStates]);

  // Estilo por estado (igual que antes)
  const getFeatureStyle = (feature) => {
    const p = feature.properties || {};
    let zoneName;
    if (p.municipio) zoneName = p.municipio;
    else if (p.serie) zoneName = `Melo (${p.serie})`;

    if (!statesLoaded) {
      return { fillColor: LOADING_FILL, weight: 1.5, opacity: 0.8, color: LOADING_STROKE, dashArray: '', fillOpacity: 0.25 };
    }

    const stateColor = zoneStates[zoneName];
    const finalColor = stateColors[stateColor] || stateColors.green;
    return { fillColor: finalColor, weight: 2, opacity: 0.9, color: finalColor, dashArray: '', fillOpacity: 0.6 };
  };

  const getStateLabel = (state) => (state === 'green' ? 'Habilitado' : state === 'yellow' ? 'Precaución' : state === 'red' ? 'Cerrado' : 'Desconocido');

  const onEachFeature = (feature, layer) => {
    const p = feature.properties || {};
    let name = 'Zona';
    let zoneName = '';
    let department = p.depto || 'Cerro Largo';
    let area = p.area_km2 != null ? Number(p.area_km2).toFixed(2) : 'N/A';

    if (p.municipio) {
      name = p.municipio;
      zoneName = name;
    } else if (p.serie) {
      name = `Melo (${p.serie})`;
      zoneName = name;
    }

    layer.bindPopup(
      `<b>${name}</b><br>` +
        `Departamento: ${department}<br>` +
        `Área: ${area} km²<br>` +
        `Estado: ${zoneStates[zoneName] ? getStateLabel(zoneStates[zoneName]) : 'Desconocido'}`
    );

    layer.on({
      mouseover: (e) => e.target.setStyle({ fillOpacity: 0.9 }),
      mouseout: (e) => e.target.setStyle({ fillOpacity: 0.6 }),
      click: () => {},
    });
  };

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

        {/* 👉 Capa única desde combined_polygons */}
        {combinedGeo && combinedGeo.features?.length > 0 && (
          <GeoJSON
            data={combinedGeo}
            style={getFeatureStyle}
            onEachFeature={onEachFeature}
            key={`combined-${JSON.stringify(zoneStates)}`}
          />
        )}

        {/* Caminería */}
        {caminosData && caminosData.features?.length > 0 && (
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

        {/* Alertas */}
        {Array.isArray(alerts) &&
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

        <ZoomHandler onZoomChange={handleZoomChange} />
      </MapContainer>
    </div>
  );
}

export default MapComponent;
