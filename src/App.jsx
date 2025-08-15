import React, { useState, useEffect } from 'react';
import MapComponent from './components/MapComponent';
import AdminPanel from './components/AdminPanel';
import './App.css';
import ReportButton from './components/Reportes/ReportButton';

function App() {
  const [zoneStates, setZoneStates] = useState({});
  const [zones, setZones] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  // en App.jsx (una vez)
const be = import.meta.env.VITE_REACT_APP_BACKEND_URL;
if (typeof window !== 'undefined') window.BACKEND_URL = be;

  

  // ← NUEVO: exponer BACKEND_URL desde tu env
  useEffect(() => {
    const be =
      (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env.VITE_REACT_APP_BACKEND_URL || import.meta.env.VITE_BACKEND_URL)) ||
      (typeof process !== 'undefined' && process.env && process.env.REACT_APP_BACKEND_URL) ||
      'https://cerro-largo-backend.onrender.com';
    if (typeof window !== 'undefined') window.BACKEND_URL = be;
  }, []);

  useEffect(() => {
    const getInitialLocation = () => {
      if (!navigator.geolocation) {
        const fallbackLocation = { lat: -32.3667, lng: -54.1667 };
        setUserLocation(fallbackLocation);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = { lat: position.coords.latitude, lng: position.coords.longitude };
          setUserLocation(location);
        },
        () => {
          const fallbackLocation = { lat: -32.3667, lng: -54.1667 };
          setUserLocation(fallbackLocation);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
      );
    };
    getInitialLocation();
  }, []);

  const handleZoneStatesLoad = (initialStates) => setZoneStates(initialStates);
  const handleZonesLoad = (zonesList) => setZones(zonesList);
  const handleZoneStateChange = (zoneName, newState) => {
    setZoneStates(prev => ({ ...prev, [zoneName]: newState }));
  };
  const handleBulkZoneStatesUpdate = (updatedStates) => {
    setZoneStates(prev => ({ ...prev, ...updatedStates }));
  };

  const handleRefreshZoneStates = async () => {
    try {
      const be = (typeof window !== 'undefined' && window.BACKEND_URL) || 'https://cerro-largo-backend.onrender.com';
      const response = await fetch(`${be}/api/admin/zones/states`, { credentials: 'include' }); // ← credenciales
      if (response.ok) {
        const data = await response.json();
        const stateMap = {};
        if (data.states) {
          for (const zoneName in data.states) {
            stateMap[zoneName] = data.states[zoneName].state;
          }
        }
        setZoneStates(stateMap);
      }
    } catch (error) {
      console.error('Error al refrescar estados de zonas:', error);
    }
  };

  const handleUserLocationChange = (location) => {
    if (location) setUserLocation(location);
  };

  return (
    <div className="app-container">
      <MapComponent
        zoneStates={zoneStates}
        onZoneStatesLoad={handleZoneStatesLoad}
        onZoneStateChange={handleZoneStateChange}
        onZonesLoad={handleZonesLoad}
        userLocation={userLocation}
      />
      <ReportButton onLocationChange={handleUserLocationChange} />
      <AdminPanel
        onRefreshZoneStates={handleRefreshZoneStates}
        onBulkZoneStatesUpdate={handleBulkZoneStatesUpdate}
      />
    </div>
  );
}

export default App;
