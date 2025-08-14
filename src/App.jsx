import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import MapComponent from './components/MapComponent';
import AdminIndex from './pages/admin';
import './App.css';
import ReportButton from './components/Reportes/ReportButton';
import { useAuth } from '@/hooks/useAuth.jsx'; // 👈 agregado

function App() {
  const [zoneStates, setZoneStates] = useState({});
  const [zones, setZones] = useState([]);
  const [userLocation, setUserLocation] = useState(null);

  // 👇 auth (para llamadas protegidas)
  const { isAuthenticated, authenticatedFetch } = useAuth();

  // Geolocalización inicial
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

  const handleZoneStatesLoad = (initialStates) => {
    setZoneStates(initialStates);
  };

  const handleZonesLoad = (zonesList) => {
    setZones(zonesList);
  };

  const handleZoneStateChange = (zoneName, newState) => {
    setZoneStates(prev => ({ ...prev, [zoneName]: newState }));
  };

  const handleBulkZoneStatesUpdate = (updatedStates) => {
    setZoneStates(prev => ({ ...prev, ...updatedStates }));
  };

  // ✅ Llamada protegida SOLO si hay sesión
  const handleRefreshZoneStates = async () => {
    try {
      if (!isAuthenticated) {
        console.warn('Intento de refrescar estados sin autenticación: omitido');
        return;
      }
      const response = await authenticatedFetch(
        'https://cerro-largo-backend.onrender.com/api/admin/zones/states'
      );
      if (response.ok) {
        const data = await response.json();
        const stateMap = {};
        if (data.states) {
          for (const zoneName in data.states) {
            stateMap[zoneName] = data.states[zoneName].state;
          }
        }
        setZoneStates(stateMap);
      } else {
        console.error('zones/states error:', await response.text());
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
      <Routes>
        {/* El panel admin (y subrutas) deberían manejar login dentro */}
        <Route path="/admin/*" element={<AdminIndex onRefreshZoneStates={handleRefreshZoneStates} />} />
        <Route
          path="/*"
          element={
            <>
              <MapComponent
                zoneStates={zoneStates}
                onZoneStatesLoad={handleZoneStatesLoad}
                onZoneStateChange={handleZoneStateChange}
                onZonesLoad={handleZonesLoad}
                userLocation={userLocation}
              />
              <ReportButton onLocationChange={handleUserLocationChange} />
            </>
          }
        />
      </Routes>
    </div>
  );
}

export default App;
