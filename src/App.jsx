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
    console.log(`Actualizando zona ${zoneName} a estado ${newState}`);
    setZoneStates(prevStates => ({
      ...prevStates,
      [zoneName]: newState
    }));
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
        // Manejar el formato de respuesta del backend (diccionario de estados)
        if (data.states) {
          for (const zoneName in data.states) {
            stateMap[zoneName] = data.states[zoneName].state;
          }
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
