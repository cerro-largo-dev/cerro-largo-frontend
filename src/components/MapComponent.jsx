import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import municipalitiesDataUrl from '../assets/cerro_largo_municipios_2025.geojson?url';
import meloAreaSeriesDataUrl from '../assets/series_cerro_largo.geojson?url';
import AdminPanel from './AdminPanel';

// Configurar iconos de Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Colores para estados de caminería (únicos colores que se mostrarán)
const stateColors = {
  green: '#22c55e',   // Verde - Habilitado
  yellow: '#eab308',  // Amarillo - Alerta
  red: '#ef4444'      // Rojo - Suspendido
};

const BACKEND_URL = 'https://cerro-largo-backend.onrender.com/';

const MapComponent = () => {
  const [geoData, setGeoData] = useState(null);
  const [meloAreaGeoData, setMeloAreaGeoData] = useState(null);
  const [zoneStates, setZoneStates] = useState({});
  const [zones, setZones] = useState([]);

  useEffect(() => {
    Promise.all([
      fetch(municipalitiesDataUrl).then(res => res.json()),
      fetch(meloAreaSeriesDataUrl).then(res => res.json())
    ])
    .then(([municipalitiesData, meloData]) => {
      setGeoData(municipalitiesData);
      setMeloAreaGeoData(meloData);

      const allZones = [];
      
      municipalitiesData.features.forEach((feature) => {
        const zoneName = feature.properties.municipio;
        allZones.push(zoneName);
      });
      
      // Add Melo area to zones
      meloData.features.forEach((feature) => {
        const zoneName = `Melo (${feature.properties.serie})`;
        allZones.push(zoneName);
      });
      
      setZones(allZones);
      
      // Cargar estados de zonas desde el backend
      loadZoneStates();
    })
    .catch(error => console.error("Error cargando GeoJSON:", error));
  }, []);

  const loadZoneStates = async () => {
    try {
      const response = await fetch('https://cerro-largo-backend.onrender.com/api/admin/zones');
      if (response.ok) {
        const zones = await response.json();
        const stateMap = {};
        zones.forEach(zone => {
          stateMap[zone.name] = zone.state;
        });
        setZoneStates(stateMap);
      }
    } catch (error) {
      console.error('Error loading zone states:', error);
    }
  };

  const handleZoneStateChange = (zoneName, newState) => {
    setZoneStates(prev => ({
      ...prev,
      [zoneName]: newState
    }));
  };

  const getFeatureStyle = (feature) => {
    let zoneName;
    
    if (feature.properties.municipio) {
      zoneName = feature.properties.municipio;
    } else if (feature.properties.serie) {
      zoneName = `Melo (${feature.properties.serie})`;
    }
    
    // Solo usar colores de estado asignados por el administrador
    const stateColor = zoneStates[zoneName] || 'green'; // Por defecto verde
    const finalColor = stateColors[stateColor];
    
    return {
      fillColor: finalColor,
      weight: 2,
      opacity: 1,
      color: '#333',
      dashArray: '',
      fillOpacity: 0.7
    };
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
      department = feature.properties.depto || 'CERRO LARGO';
      area = 'N/A';
    }

    const currentState = zoneStates[zoneName] || 'green';
    const stateLabel = {
      green: '🟩 Habilitado',
      yellow: '🟨 Alerta',
      red: '🟥 Suspendido'
    }[currentState];

    layer.bindPopup(`
      <div class="municipality-popup">
        <h3>${name}</h3>
        <p><strong>Departamento:</strong> ${department}</p>
        <p><strong>Área:</strong> ${area} km²</p>
        <p><strong>Estado:</strong> ${stateLabel}</p>
      </div>
    `);

    layer.on({
      mouseover: function(e) {
        const layer = e.target;
        layer.setStyle({
          weight: 3,
          color: '#666',
          dashArray: '',
          fillOpacity: 0.9
        });
        layer.bringToFront();
      },
      mouseout: function(e) {
        const layer = e.target;
        layer.setStyle(getFeatureStyle(feature));
      }
    });
  };

  const mapCenter = [-32.8, -54.2]; // Ajustado para Cerro Largo

  if (!geoData || !meloAreaGeoData) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Cargando mapa...</div>
      </div>
    );
  }

  // Función para descargar reporte - disponible para todos los usuarios
  const downloadReport = async () => {
    try {
      const response = await fetch('https://cerro-largo-backend.onrender.com/api/report/download');
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = 'reporte_camineria_cerro_largo.pdf';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        console.error('Error downloading report');
      }
    } catch (error) {
      console.error('Error downloading report:', error);
    }
   };

  return (
    <div className="relative w-full h-screen">
      {/* Botón de descarga de reportes - disponible para todos los usuarios */}
      <button
        onClick={downloadReport}
        className="absolute top-4 right-4 z-[1000] bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-blue-700 transition-colors"
      >
        📄 Descargar Reporte
      </button>

      {/* Panel de administrador */}
      <AdminPanel 
        onZoneStateChange={handleZoneStateChange}
        zoneStates={zoneStates}
        zones={zones}
      />

      <MapContainer
        center={mapCenter}
        zoom={9}
        className="leaflet-container"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {geoData.features.length > 0 && (
          <GeoJSON
            data={geoData}
            style={getFeatureStyle}
            onEachFeature={onEachFeature}
            key={`municipalities-${JSON.stringify(zoneStates)}`}
          />
        )}
        
        {meloAreaGeoData.features.length > 0 && (
          <GeoJSON
            data={meloAreaGeoData}
            style={getFeatureStyle}
            onEachFeature={onEachFeature}
            key={`melo-${JSON.stringify(zoneStates)}`}
          />
        )}
      </MapContainer>
    </div>
  );
};

export default MapComponent;

