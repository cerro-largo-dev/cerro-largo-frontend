import React, { useState } from 'react';
import MapComponent from './components/MapComponent';
import AdminPanel from './components/AdminPanel';
import './App.css';

function App() {
  // ESTADO COMPARTIDO: Elevar zoneStates al nivel del componente padre
  const [zoneStates, setZoneStates] = useState({});
  const [zones, setZones] = useState([]);

  // Callback para cuando MapComponent carga los datos iniciales
  const handleZoneStatesLoad = (initialStates) => {
    console.log('Cargando estados iniciales:', initialStates);
    setZoneStates(initialStates);
  };

  // Callback para cuando se cargan las zonas disponibles
  const handleZonesLoad = (zonesList) => {
    console.log('Cargando lista de zonas:', zonesList);
    setZones(zonesList);
  };

  // Callback para cuando AdminPanel o MapComponent realizan cambios individuales
  const handleZoneStateChange = (zoneName, newState) => {
    console.log(`App.jsx: Actualizando zona ${zoneName} a estado ${newState}`);
    setZoneStates(prevStates => {
      const newStates = {
        ...prevStates,
        [zoneName]: newState
      };
      console.log('App.jsx: Nuevo estado completo:', newStates);
      return newStates;
    });
  };

  // Callback para actualizar múltiples zonas (bulk updates desde AdminPanel)
  const handleBulkZoneStatesUpdate = (updatedStates) => {
    console.log('Actualizando múltiples zonas:', updatedStates);
    setZoneStates(prevStates => ({
      ...prevStates,
      ...updatedStates
    }));
  };

  // Callback para refrescar completamente los datos desde el servidor
  const handleRefreshZoneStates = async () => {
    try {
      const response = await fetch('https://cerro-largo-backend.onrender.com/api/admin/zones/states');
      if (response.ok) {
        const data = await response.json();
        const stateMap = {};
        
        // Manejar diferentes formatos de respuesta del backend
        if (data.zones && Array.isArray(data.zones)) {
          data.zones.forEach(zone => {
            stateMap[zone.name] = zone.state;
          });
        } else if (Array.isArray(data)) {
          data.forEach(zone => {
            stateMap[zone.zone_name] = zone.state;
          });
        }
        
        setZoneStates(stateMap);
        console.log('Estados de zonas refrescados desde el servidor:', stateMap);
      }
    } catch (error) {
      console.error('Error al refrescar estados de zonas:', error);
    }
  };

  return (
    <div className="app-container">
      {/* Componente del Mapa */}
      <MapComponent 
        zoneStates={zoneStates}
        onZoneStatesLoad={handleZoneStatesLoad}
        onZoneStateChange={handleZoneStateChange}
        onZonesLoad={handleZonesLoad}
      />
      
      {/* Panel de Administración */}
      <AdminPanel 
        zoneStates={zoneStates}
        zones={zones}
        onZoneStateChange={handleZoneStateChange}
        onBulkUpdate={handleBulkZoneStatesUpdate}
        onRefresh={handleRefreshZoneStates}
      />
    </div>
  );
}

export default App;
