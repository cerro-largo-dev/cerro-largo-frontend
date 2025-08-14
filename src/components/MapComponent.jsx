import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap, Popup, Marker } from 'react-leaflet';
import L from 'leaflet';
import municipalitiesDataUrl from '../assets/cerro_largo_municipios_2025.geojson?url';
import meloAreaSeriesDataUrl from '../assets/series_cerro_largo.geojson?url';
import caminosDataUrl from '../assets/camineria_cerro_largo.json?url';
import { getRoadStyle, onEachRoadFeature } from '../utils/caminosUtils';
import { zonesAPI, BACKEND_URL } from '@/lib/api.js';
import { useAuth } from '@/hooks/useAuth.jsx';

// Config Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Icono GPS
const gpsIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#3b82f6" width="24" height="24">
      <circle cx="12" cy="12" r="8" fill="#3b82f6" stroke="#ffffff" stroke-width="2"/>
      <circle cx="12" cy="12" r="4" fill="#ffffff"/>
    </svg>
  `),
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -12],
  className: 'gps-marker-icon'
});

// Colores por estado
const stateColors = { green: "#22c55e", yellow: '#eab308', red: '#ef4444' };

// Componente para manejar zoom
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
  onZonesLoad,
  userLocation
}) {
  const { isAuthenticated } = useAuth();

  const [geoData, setGeoData] = useState(null);
  const [meloAreaGeoData, setMeloAreaGeoData] = useState(null);
  const [caminosData, setCaminosData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [currentZoom, setCurrentZoom] = useState(9);
  const mapRef = useRef(null);

  const mapCenter = [-32.55, -54.00];

  const handleZoomChange = (z) => setCurrentZoom(z);
  const getRoadStyleWithZoom = (feature) => getRoadStyle(feature, currentZoom);

  // Carga de capas estáticas (no requieren auth)
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [r1, r2, r3] = await Promise.all([
          fetch(municipalitiesDataUrl),
          fetch(meloAreaSeriesDataUrl),
          fetch(caminosDataUrl)
        ]);
        if (!r1.ok || !r2.ok || !r3.ok) throw new Error('Error al cargar capas');

        const [municipalitiesData, meloData, caminosDataJson] = await Promise.all([
          r1.json(), r2.json(), r3.json()
        ]);

        setGeoData(municipalitiesData);
        setMeloAreaGeoData(meloData);
        setCaminosData(caminosDataJson);

        // Notificar zonas disponibles al padre
        const allZones = [
          ...municipalitiesData.features.map(f => f.properties.municipio),
          ...meloData.features.map(f => `Melo (${f.properties.serie})`)
        ];
        onZonesLoad?.(allZones);
      } catch (e) {
        console.error("Error cargando datos del mapa:", e);
        setMessage({ type: 'error', text: 'Error al cargar datos del mapa' });
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [onZonesLoad]);

  // Carga de estados (sí requiere auth)
  useEffect(() => {
    if (!isAuthenticated) return; // evita 401 si no hay sesión
    loadZoneStates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const loadZoneStates = async () => {
    try {
      const res = await zonesAPI.getStates(); // ← usa Authorization automáticamente
      if (!res.ok) {
        if (res.status === 401) {
          setMessage({ type: 'error', text: 'Sesión expirada o no iniciada.' });
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      const map = {};
      for (const [zoneName, z] of Object.entries(data?.states || {})) {
        map[zoneName] = z?.state || 'green';
      }
      onZoneStatesLoad?.(map);
    } catch (err) {
      console.error('Error loading zone states:', err);
      setMessage({ type: 'error', text: 'Error al cargar estados de zonas' });
    }
  };

  const reloadMapData = async () => {
    if (!isAuthenticated) {
      setMessage({ type: 'error', text: 'Inicia sesión para actualizar estados.' });
      return;
    }
    setLoading(true);
    await loadZoneStates();
    setLoading(false);
  };

  const getFeatureStyle = (feature) => {
    let zoneName = feature.properties.municipio
      ? feature.properties.municipio
      : `Melo (${feature.properties.serie})`;
    const stateColor = zoneStates[zoneName] || 'green';
    const color = stateColors[stateColor];
    return { fillColor: color, weight: 2, opacity: 0.9, color, dashArray: '', fillOpacity: 0.6 };
  };

  const getStateLabel = (state) =>
    state === 'green' ? 'Habilitado'
      : state === 'yellow' ? 'Alerta'
      : state === 'red' ? 'Suspendido'
      : 'Desconocido';

  const onEachFeature = (feature, layer) => {
    const zoneName = feature.properties.municipio
      ? feature.properties.municipio
      : `Melo (${feature.properties.serie})`;
    const depto = feature.properties.depto;
    const area = feature.properties.area_km2 ? feature.properties.area_km2.toFixed(2) : 'N/A';

    layer.bindPopup(
      `<b>${zoneName}</b><br>Departamento: ${depto}<br>Área: ${area} km²<br>` +
      `Estado: ${zoneStates[zoneName] ? getStateLabel(zoneStates[zoneName]) : 'Desconocido'}`
    );
    layer.on({
      mouseover: e => e.target.setStyle({ fillOpacity: 0.9 }),
      mouseout: e => e.target.setStyle({ fillOpacity: 0.6 }),
    });
  };

  // Descarga de reporte público (si tu endpoint es público; si es admin protégelo)
  const downloadReport = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${BACKEND_URL}/api/report/download`);
      if (!response.ok) throw new Error('Error al descargar');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = "none";
      a.href = url;
      a.download = 'reporte_camineria_cerro_largo.pdf';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e) {
      console.error('Error downloading report:', e);
      setMessage({ type: 'error', text: 'Error al descargar reporte' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative w-full h-screen">
      {message.text && (
        <div className={`absolute top-4 left-4 z-[1000] p-3 rounded-lg ${
          message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {message.text}
          <button onClick={() => setMessage({ type: '', text: '' })} className="ml-2 text-sm">✕</button>
        </div>
      )}

      <div className="absolute top-4 right-4 z-[1000] flex gap-2">
        <button onClick={reloadMapData} className="bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-green-700 disabled:opacity-50" disabled={loading}>
          {loading ? 'Actualizando...' : 'Actualizar Mapa'}
        </button>
        <button onClick={downloadReport} className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-blue-700 disabled:opacity-50" disabled={loading}>
          {loading ? 'Descargando...' : 'Descargar Reporte'}
        </button>
      </div>

      <MapContainer center={mapCenter} zoom={9} className="leaflet-container" style={{ width: '100%', height: '100%' }}>
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
            style={getRoadStyleWithZoom}
            onEachFeature={onEachRoadFeature}
            key={`caminos-layer-zoom-${currentZoom}`}
            pathOptions={{ interactive: true, bubblingMouseEvents: false }}
          />
        )}

        {userLocation && (
          <Marker position={[userLocation.lat, userLocation.lng]} icon={gpsIcon}>
            <Popup>
              <div className="text-center">
                <strong>Tu ubicación actual</strong><br/>
                <small>Lat: {userLocation.lat.toFixed(6)}<br/>Lng: {userLocation.lng.toFixed(6)}</small>
              </div>
            </Popup>
          </Marker>
        )}

        <ZoomHandler onZoomChange={handleZoomChange} />
      </MapContainer>
    </div>
  );
}

export default MapComponent;

