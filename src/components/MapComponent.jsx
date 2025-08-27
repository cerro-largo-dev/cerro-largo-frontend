// src/components/MapComponent-optimized.jsx - Versión optimizada para LCP
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap, Popup, Marker } from 'react-leaflet';
import L from 'leaflet';

import { ROAD_VIS_THRESHOLD, getRoadStyle, onEachRoadFeature, REPORT_VIS_THRESHOLD } from '../utils/caminosUtils';

// ----------------- Iconos Leaflet optimizados -----------------
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Ícono GPS optimizado
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

// Ícono de atención optimizado
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

// ----------------- Utilidades de estado -----------------
const getZoneColor = (state) => {
  switch (state) {
    case 'green': return '#22c55e';
    case 'yellow': return '#eab308';
    case 'red': return '#ef4444';
    default: return '#6b7280';
  }
};

const getZoneStyle = (feature, zoneStates) => {
  const zoneName = feature.properties?.name || feature.properties?.NAME;
  const state = zoneStates[zoneName] || 'red';
  return {
    fillColor: getZoneColor(state),
    weight: 2,
    opacity: 1,
    color: 'white',
    dashArray: '3',
    fillOpacity: 0.7
  };
};

// ----------------- Hook para preload de tiles críticos -----------------
const useTilePreloader = (center, zoom) => {
  useEffect(() => {
    if (!center || !zoom) return;

    const preloadTiles = () => {
      const tileSize = 256;
      const numTiles = Math.pow(2, zoom);
      const pixelOrigin = [
        (center[1] + 180) / 360 * numTiles * tileSize,
        (1 - Math.log(Math.tan(center[0] * Math.PI / 180) + 1 / Math.cos(center[0] * Math.PI / 180)) / Math.PI) / 2 * numTiles * tileSize
      ];

      const tileX = Math.floor(pixelOrigin[0] / tileSize);
      const tileY = Math.floor(pixelOrigin[1] / tileSize);

      // Precargar tiles en un radio de 2x2 alrededor del centro
      const tilesToPreload = [];
      for (let x = tileX - 1; x <= tileX + 1; x++) {
        for (let y = tileY - 1; y <= tileY + 1; y++) {
          if (x >= 0 && y >= 0 && x < numTiles && y < numTiles) {
            const servers = ['a', 'b', 'c'];
            const server = servers[Math.abs(x + y) % servers.length];
            tilesToPreload.push(`https://${server}.tile.openstreetmap.org/${zoom}/${x}/${y}.png`);
          }
        }
      }

      // Crear elementos img para precargar
      tilesToPreload.forEach((url, index) => {
        setTimeout(() => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.loading = 'eager';
          img.fetchPriority = index === 0 ? 'high' : 'low'; // Primera tile con prioridad alta
          img.src = url;
        }, index * 50); // Escalonar las cargas
      });
    };

    // Precargar después de un breve delay para no bloquear el render inicial
    const timeoutId = setTimeout(preloadTiles, 100);
    return () => clearTimeout(timeoutId);
  }, [center, zoom]);
};

// ----------------- Componente de TileLayer optimizado -----------------
const OptimizedTileLayer = ({ center, zoom }) => {
  useTilePreloader(center, zoom);

  return (
    <TileLayer
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      maxZoom={18}
      minZoom={8}
      // Optimizaciones de rendimiento
      updateWhenIdle={false}
      updateWhenZooming={false}
      keepBuffer={2}
      // Configuración de subdomains para paralelización
      subdomains={['a', 'b', 'c']}
      // Configuración de crossOrigin para cache
      crossOrigin={true}
      // Configuración de loading
      className="leaflet-tile-optimized"
    />
  );
};

// ----------------- Componente principal -----------------
const MapComponent = ({
  userLocation,
  onUserLocationRequest,
  zoneStates = {},
  onZoneStatesLoad,
  zones = [],
  onZonesLoad,
  alerts = [],
  geoData = null
}) => {
  // Estados locales
  const [mapReady, setMapReady] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(9);
  const mapRef = useRef(null);

  // Configuración del mapa optimizada para Cerro Largo
  const mapConfig = useMemo(() => ({
    center: [-32.3667, -54.1667], // Centro de Cerro Largo
    zoom: 9,
    minZoom: 8,
    maxZoom: 18,
    zoomControl: true,
    attributionControl: true,
    preferCanvas: true, // Mejor rendimiento para muchos elementos
  }), []);

  // Datos GeoJSON memoizados
  const geoJsonData = useMemo(() => {
    if (geoData) return geoData;
    
    // Fallback: cargar desde assets si no se pasó como prop
    return null;
  }, [geoData]);

  // Estilo de zonas memoizado
  const zoneStyleFunction = useCallback((feature) => {
    return getZoneStyle(feature, zoneStates);
  }, [zoneStates]);

  // Handler para eventos de zona
  const onEachZoneFeature = useCallback((feature, layer) => {
    const zoneName = feature.properties?.name || feature.properties?.NAME || 'Zona desconocida';
    const state = zoneStates[zoneName] || 'red';
    
    layer.bindPopup(`
      <div class="zone-popup">
        <h3 class="font-semibold text-lg mb-2">${zoneName}</h3>
        <div class="flex items-center gap-2">
          <div class="w-4 h-4 rounded-full" style="background-color: ${getZoneColor(state)}"></div>
          <span class="capitalize">${state === 'green' ? 'Bueno' : state === 'yellow' ? 'Regular' : 'Malo'}</span>
        </div>
      </div>
    `, {
      closeButton: true,
      autoClose: false,
      className: 'zone-popup-container'
    });

    // Eventos de hover optimizados
    layer.on({
      mouseover: (e) => {
        const layer = e.target;
        layer.setStyle({
          weight: 3,
          color: '#666',
          dashArray: '',
          fillOpacity: 0.9
        });
        layer.bringToFront();
      },
      mouseout: (e) => {
        const layer = e.target;
        layer.setStyle(zoneStyleFunction(feature));
      }
    });
  }, [zoneStates, zoneStyleFunction]);

  // Componente interno para manejar eventos del mapa
  const MapEventHandler = () => {
    const map = useMap();

    useEffect(() => {
      if (!map) return;

      const handleZoomEnd = () => {
        setCurrentZoom(map.getZoom());
      };

      const handleMoveEnd = () => {
        // Opcional: actualizar tiles visibles
      };

      map.on('zoomend', handleZoomEnd);
      map.on('moveend', handleMoveEnd);

      // Marcar mapa como listo
      setMapReady(true);
      mapRef.current = map;

      return () => {
        map.off('zoomend', handleZoomEnd);
        map.off('moveend', handleMoveEnd);
      };
    }, [map]);

    return null;
  };

  // Handler para solicitar ubicación
  const handleLocationRequest = useCallback(() => {
    if (onUserLocationRequest) {
      onUserLocationRequest();
    }
  }, [onUserLocationRequest]);

  // Efecto para centrar en ubicación del usuario
  useEffect(() => {
    if (userLocation && mapRef.current) {
      mapRef.current.setView([userLocation.lat, userLocation.lng], 12, {
        animate: true,
        duration: 1
      });
    }
  }, [userLocation]);

  return (
    <div className="map-container relative w-full h-screen">
      <MapContainer
        {...mapConfig}
        className="leaflet-container-optimized"
        whenCreated={(map) => {
          mapRef.current = map;
          // Configuraciones adicionales del mapa
          map.getContainer().focus = () => {}; // Evitar focus automático
        }}
      >
        <MapEventHandler />
        
        {/* TileLayer optimizado */}
        <OptimizedTileLayer center={mapConfig.center} zoom={mapConfig.zoom} />

        {/* GeoJSON de zonas */}
        {geoJsonData && (
          <GeoJSON
            data={geoJsonData}
            style={zoneStyleFunction}
            onEachFeature={onEachZoneFeature}
          />
        )}

        {/* Marcador de ubicación del usuario */}
        {userLocation && (
          <Marker
            position={[userLocation.lat, userLocation.lng]}
            icon={gpsIcon}
          >
            <Popup>
              <div className="text-center">
                <strong>Tu ubicación</strong>
                <br />
                <small>
                  {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}
                </small>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Marcadores de alertas */}
        {currentZoom >= REPORT_VIS_THRESHOLD && alerts.map((alert) => (
          <Marker
            key={`alert-${alert.id}`}
            position={[alert.lat, alert.lng]}
            icon={attentionIcon}
          >
            <Popup>
              <div className="alert-popup">
                <h4 className="font-semibold text-amber-800 mb-1">{alert.titulo}</h4>
                {alert.descripcion && (
                  <p className="text-sm text-gray-600">{alert.descripcion}</p>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Botón de ubicación */}
      <button
        onClick={handleLocationRequest}
        className="absolute top-4 right-4 z-[1000] bg-white hover:bg-gray-50 border border-gray-300 rounded-lg p-3 shadow-lg transition-colors"
        title="Encontrar mi ubicación"
        aria-label="Encontrar mi ubicación"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="3,11 22,2 13,21 11,13 3,11"></polygon>
        </svg>
      </button>

      {/* Indicador de carga */}
      {!mapReady && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-[1001]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">Inicializando mapa...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapComponent;

