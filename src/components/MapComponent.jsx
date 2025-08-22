// src/components/MapComponent.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap, Popup, Marker } from 'react-leaflet';
import L from 'leaflet';
import municipalitiesDataUrl from '../assets/combined_polygons.geojson?url';
import meloAreaSeriesDataUrl from '../assets/series_cerro_largo.geojson?url';
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
      <g>
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
              fill="#000000"/>
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

// Colores para estados
const stateColors = {
  green: '#22c55e',
  yellow: '#eab308',
  red: '#ef4444',
};

// Manejar eventos de zoom
function ZoomHandler({ onZoomChange }) {
  const map = useMap();

  useEffect(() => {
    const handleZoom = () => onZoomChange(map.getZoom());
    map.on('zoomend', handleZoom);
    onZoomChange(map.getZoom());
    return () => {
      map.off('zoomend', handleZoom);
    };
  }, [map, onZoomChange]);

  return null;
}

function MapComponent({
  zoneStates,
  onZoneStatesLoad,
  onZoneStateChange,
  onZonesLoad,
  userLocation,
  // ALERTAS opcionales a pintar en el mapa: [{ id, lat, lng, titulo, descripcion }]
  alerts = [],
}) {
  const [geoData, setGeoData] = useState(null);
  const [meloAreaGeoData, setMeloAreaGeoData] = useState(null);
  const [caminosData, setCaminosData] = useState(null);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [currentZoom, setCurrentZoom] = useState(8);
  const mapRef = useRef(null);

  // BACKEND_URL coherente con App.jsx (window/env) y sin barra final
  const BACKEND_URL = useMemo(() => {
    const fromWin = (typeof window !== 'undefined' && window.BACKEND_URL) ? String(window.BACKEND_URL) : '';
    const envs =
      (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env.VITE_REACT_APP_BACKEND_URL || import.meta.env.VITE_BACKEND_URL)) ||
      (typeof process !== 'undefined' && process.env && (process.env.REACT_APP_BACKEND_URL || process.env.VITE_BACKEND_URL)) ||
      '';
    const base = (fromWin || envs || 'https://cerro-largo-backend.onrender.com').replace(/\/$/, '');
    return base;
  }, []);

  const mapCenter = [-32.35, -54.20];
  const handleZoomChange = (newZoom) => setCurrentZoom(newZoom);

  // Helper: fetch JSON con timeout y backoff
  const fetchJsonRetry = useCallback(async (url, opts = {}, { retries = 3, baseDelay = 500, timeoutMs = 8000 } = {}) => {
    for (let i = 0; i <= retries; i++) {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), timeoutMs);
        const res = await fetch(url, {
          credentials: 'include',
          cache: 'no-store',
          mode: 'cors',
          signal: ctrl.signal,
          ...opts,
        });
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

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        const [municipalitiesResponse, meloResponse, caminosResponse] = await Promise.all([
          fetch(municipalitiesDataUrl),
          fetch(meloAreaSeriesDataUrl),
          fetch(caminosDataUrl),
        ]);

        if (municipalitiesResponse.ok && meloResponse.ok && caminosResponse.ok) {
          const [municipalitiesData, meloData, caminosDataJson] = await Promise.all([
            municipalitiesResponse.json(),
            meloResponse.json(),
            caminosResponse.json(),
          ]);

          setGeoData(municipalitiesData);
          setMeloAreaGeoData(meloData);
          setCaminosData(caminosDataJson);

          // Extraer nombres de zonas
          const allZones = [];
          municipalitiesData.features.forEach((f) => {
            const zoneName = f.properties.municipio;
            allZones.push(zoneName);
          });

          // Agregar zonas del área de Melo
          meloData.features.forEach((f) => {
            const zoneName = `Melo (${f.properties.serie})`;
            allZones.push(zoneName);
          });

          setZones(allZones);
          onZonesLoad && onZonesLoad(allZones);

          // Cargar estados de zonas desde backend
          await loadZoneStates();
        } else {
          throw new Error('GeoJSON assets no disponibles');
        }
      } catch (error) {
        console.error('Error cargando datos del mapa:', error);
        setMessage({ type: 'error', text: 'Error al cargar datos del mapa' });
      } finally {
        setLoading(false);
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
          // { states: { "AREVALO": { state:"green" }, ... } }
          for (const zoneName in data.states) {
            const v = data.states[zoneName];
            const raw = typeof v === 'string' ? v : (v && v.state);
            stateMap[zoneName] = String(raw || '').toLowerCase();
          }
        } else {
          // { "AREVALO": "green", ... }
          for (const k of Object.keys(data)) {
            stateMap[k] = String(data[k] || '').toLowerCase();
          }
        }
      }
      onZoneStatesLoad && onZoneStatesLoad(stateMap);
    } catch (error) {
      console.error('Error loading zone states:', error);
      setMessage({ type: 'error', text: 'Error al cargar estados de zonas' });
    }
  }, [BACKEND_URL, fetchJsonRetry, onZoneStatesLoad]);

  // refrescar cuando AdminPanel emite cambio
  useEffect(() => {
    const handler = () => loadZoneStates();
    window.addEventListener('zoneStateUpdated', handler);
    return () => window.removeEventListener('zoneStateUpdated', handler);
  }, [loadZoneStates]);

  const getFeatureStyle = (feature) => {
    let zoneName;
    if (feature.properties.municipio) {
      zoneName = feature.properties.municipio;
    } else if (feature.properties.serie) {
      zoneName = `Melo (${feature.properties.serie})`;
    }

    const stateColor = zoneStates[zoneName] || 'green';
    const finalColor = stateColors[stateColor] || stateColors.green;

    return {
      fillColor: finalColor,
      weight: 2,
      opacity: 0.9,
      color: finalColor,
      dashArray: '',
      fillOpacity: 0.6,
    };
  };

  const getStateLabel = (state) => {
    switch (state) {
      case 'green':
        return 'Habilitado';
      case 'yellow':
        return 'Alerta';
      case 'red':
        return 'Suspendido';
      default:
        return 'Desconocido';
    }
  };

  const onEachFeature = (feature, layer) => {
    let name, department, area, zoneName;

    if (feature.properties.municipio) {
      name = feature.properties.municipio;
      zoneName = name;
      department = feature.properties.depto;
      area = feature.properties.area_km2 ? feature.properties.area_km2.toFixed(2) : 'N/A';
    } else if (feature.properties.serie) {
      name = `Melo (${feature.properties.serie})`;
      zoneName = name;
      department = feature.properties.depto;
      area = feature.properties.area_km2 ? feature.properties.area_km2.toFixed(2) : 'N/A';
    }

    layer.bindPopup(
      `<b>${name}</b><br>` +
        `Departamento: ${department}<br>` +
        `Área: ${area} km²<br>` +
        `Estado: ${zoneStates[zoneName] ? getStateLabel(zoneStates[zoneName]) : 'Desconocido'}`
    );

    layer.on({
      mouseover: (e) => {
        e.target.setStyle({ fillOpacity: 0.9 });
      },
      mouseout: (e) => {
        e.target.setStyle({ fillOpacity: 0.6 });
      },
      click: () => {
        // Sin acción de click: el estado se maneja desde AdminPanel/App
      },
    });
  };

  return (
    <div className="relative w-full h-screen">
      {/* Mensajes de estado */}
      {message.text && (
        <div
          className={`absolute top-4 left-4 z-[1000] p-3 rounded-lg ${
            message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
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

        {geoData && geoData.features.length > 0 && (
          <GeoJSON
            data={geoData}
            style={getFeatureStyle}
            onEachFeature={onEachFeature}
            key={`municipalities-${JSON.stringify(zoneStates)}`}
          />
        )}

        {meloAreaGeoData && meloAreaGeoData.features.length > 0 && (
          <GeoJSON
            data={meloAreaGeoData}
            style={getFeatureStyle}
            onEachFeature={onEachFeature}
            key={`melo-${JSON.stringify(zoneStates)}`}
          />
        )}

        {caminosData && caminosData.features.length > 0 && (
          <GeoJSON
            data={caminosData}
            style={(f) => getRoadStyle(f, currentZoom)}
            onEachFeature={onEachRoadFeature}
            key={`caminos-layer-zoom-${currentZoom}`}
            pathOptions={{ interactive: true, bubblingMouseEvents: false }}
          />
        )}

        {/* Marcador de la ubicación del usuario */}
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

        {/* Marcadores de ALERTA */}
        {Array.isArray(alerts) &&
          alerts.map((a) =>
            a && a.lat != null && a.lng != null ? (
              <Marker key={`alert-${a.id}`} position={[a.lat, a.lng]} icon={attentionIcon}>
                <Popup>
                  <div style={{ minWidth: 180 }}>
                    <strong>{a.titulo || 'Reporte'}</strong>
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
