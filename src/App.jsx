import React, { useState, useEffect } from 'react';
import MapComponent from './components/MapComponent';
import AdminPanel from './components/AdminPanel';
import './App.css';
import ReportButton from './components/Reportes/ReportButton';

function App() {
  const [zoneStates, setZoneStates] = useState({});
  const [zones, setZones] = useState([]);
  const [userLocation, setUserLocation] = useState(null); // Estado para la ubicación del usuario

  // Obtener geolocalización al iniciar la aplicación
  useEffect(() => {
    const getInitialLocation = () => {
      if (!navigator.geolocation) {
        console.log('Geolocalización no soportada, usando ubicación de fallback');
        const fallbackLocation = { lat: -32.3667, lng: -54.1667 };
        setUserLocation(fallbackLocation);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          console.log('Ubicación inicial obtenida:', location);
          setUserLocation(location);
        },
        (error) => {
          console.error('Error al obtener ubicación inicial:', error);
          // Usar coordenadas de Cerro Largo como fallback
          const fallbackLocation = { lat: -32.3667, lng: -54.1667 };
          console.log('Usando ubicación de fallback:', fallbackLocation);
          setUserLocation(fallbackLocation);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutos
        }
      );
    };

    getInitialLocation();
  }, []);

  const handleZoneStatesLoad = (initialStates) => {
    console.log('Cargando estados iniciales:', initialStates);
    setZoneStates(initialStates);
  };

  const handleZonesLoad = (zonesList) => {
    console.log('Cargando lista de zonas:', zonesList);
    setZones(zonesList);
  };

  const handleZoneStateChange = (zoneName, newState) => {
    console.log(`Actualizando zona ${zoneName} a estado ${newState}`);
    setZoneStates(prevStates => ({
      ...prevStates,
      [zoneName]: newState
    }));
  };

  const handleBulkZoneStatesUpdate = (updatedStates) => {
    console.log('Actualizando múltiples zonas:', updatedStates);
    setZoneStates(prevStates => ({
      ...prevStates,
      ...updatedStates
    }));
  };

  const handleRefreshZoneStates = async () => {
    try {
      const response = await fetch('https://cerro-largo-backend.onrender.com/api/admin/zones/states');
      if (response.ok) {
        const data = await response.json();
        const stateMap = {};
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

  // Callback para actualizar la ubicación del usuario desde el modal de reporte
  const handleUserLocationChange = (location) => {
    if (location) {
      console.log('App actualizando ubicación desde modal:', location);
      setUserLocation(location);
    }
  };

  return (
    <div className="app-container">
      <MapComponent 
        zoneStates={zoneStates}
        onZoneStatesLoad={handleZoneStatesLoad}
        onZoneStateChange={handleZoneStateChange}
        onZonesLoad={handleZonesLoad}
        userLocation={userLocation} // Pasar la ubicación del usuario al MapComponent
      />
      
      <ReportButton onLocationChange={handleUserLocationChange} /> {/* Pasar el callback al ReportButton */}
      <AdminPanel onRefreshZoneStates={handleRefreshZoneStates} onBulkZoneStatesUpdate={handleBulkZoneStatesUpdate} />
    </div>
  );
}

export default App;
