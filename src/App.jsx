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

  // Mostrar AdminPanel solo en /admin
  const [isAdminRoute, setIsAdminRoute] = useState(false);
  useEffect(() => {
    const compute = () => {
      try {
        const path = (typeof window !== 'undefined' && window.location && window.location.pathname) || '';
        setIsAdminRoute(/^\/admin\/?$/.test(path));
      } catch {
        setIsAdminRoute(false);
      }
    };
    compute();
    window.addEventListener('popstate', compute);
    return () => window.removeEventListener('popstate', compute);
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

      {isAdminRoute && (
        <AdminPanel
          onRefreshZoneStates={handleRefreshZoneStates}
          onBulkZoneStatesUpdate={handleBulkZoneStatesUpdate}
          onZoneStateChange={handleZoneStateChange}   // ← NUEVO
        />
      )}
    </div>
  );
}

export default App;
```jsx
import React, { useEffect, useState } from 'react';
import MapComponent from './components/MapComponent';
import AdminPanel from './components/AdminPanel';
import ReportButton from './components/Reportes/ReportButton';
import './App.css';

export default function App() {
  const [zoneStates, setZoneStates] = useState({}); // { "ARÉVALO": "green", ... }
  const [zones, setZones] = useState([]);
  const [userLocation, setUserLocation] = useState(null);

  // Mostrar AdminPanel solo en /admin
  const [isAdminRoute, setIsAdminRoute] = useState(false);

  // Exponer la URL del backend para otros componentes (coincide con tu patrón)
  useEffect(() => {
    const be = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_REACT_APP_BACKEND_URL) || '';
    if (typeof window !== 'undefined' && be) window.BACKEND_URL = be;
  }, []);

  // Detectar si la ruta actual es /admin (y reaccionar a navegaciones con back/forward)
  useEffect(() => {
    const compute = () => {
      try {
        const path = (typeof window !== 'undefined' && window.location && window.location.pathname) || '';
        setIsAdminRoute(/^\/admin\/?$/.test(path));
      } catch {
        setIsAdminRoute(false);
      }
    };
    compute();
    window.addEventListener('popstate', compute);
    return () => window.removeEventListener('popstate', compute);
  }, []);

  const BACKEND_URL =
    (typeof window !== 'undefined' && window.BACKEND_URL) ||
    (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_REACT_APP_BACKEND_URL) ||
    'https://cerro-largo-backend.onrender.com';

  const fetchJson = async (url, options = {}) => {
    const res = await fetch(url, { credentials: 'include', ...options });
    const ct = res.headers.get('content-type') || '';
    const text = await res.text();
    if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + res.statusText + ': ' + text.slice(0,200));
    if (!ct.includes('application/json')) throw new Error('No-JSON: ' + text.slice(0,200));
    return JSON.parse(text);
  };

  // --- Callbacks que ya usabas ---
  const handleZoneStateChange = (zoneName, newStateEn) => {
    // Actualiza inmediatamente el estado para que el mapa se refresque sin recargar
    setZoneStates((prev) => ({ ...prev, [zoneName]: newStateEn }));
  };

  const handleRefreshZoneStates = async () => {
    try {
      const data = await fetchJson(`${BACKEND_URL.replace(/\/$/,'')}/api/admin/zones/states`);
      if (data?.success && data.states) {
        // states viene como { name: {state:"green"|...} }
        const mapping = {};
        Object.entries(data.states).forEach(([name, info]) => { mapping[name] = (info && info.state) || 'red'; });
        setZoneStates(mapping);
      }
    } catch (e) {
      console.warn('No se pudo refrescar estados:', e.message);
    }
  };

  const handleBulkZoneStatesUpdate = (updatesMap) => {
    // Espera algo tipo { "ARÉVALO": "green", ... }
    if (!updatesMap || typeof updatesMap !== 'object') return;
    setZoneStates((prev) => ({ ...prev, ...updatesMap }));
  };

  const handleZonesLoad = (loadedZones) => {
    if (Array.isArray(loadedZones)) setZones(loadedZones);
  };

  const handleUserLocationChange = (loc) => {
    setUserLocation(loc);
  };

  return (
    <div className="App">
      <MapComponent
        zones={zones}
        zoneStates={zoneStates}
        onZoneStateChange={handleZoneStateChange}
        onZonesLoad={handleZonesLoad}
        userLocation={userLocation}
      />

      <ReportButton onLocationChange={handleUserLocationChange} />

      {/* → CAMBIO: le pasamos onZoneStateChange al AdminPanel */}
      <AdminPanel
        onRefreshZoneStates={handleRefreshZoneStates}
        onBulkZoneStatesUpdate={handleBulkZoneStatesUpdate}
        onZoneStateChange={handleZoneStateChange}
      />
    </div>
  );
}
