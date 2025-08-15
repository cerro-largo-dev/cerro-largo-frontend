import React, { useState, useEffect } from 'react';
import MapComponent from './components/MapComponent';
import AdminPanel from './components/AdminPanel';
import ReportButton from './components/Reportes/ReportButton';
import './App.css';

export default function App() {
  const [zoneStates, setZoneStates] = useState({});
  const [zones, setZones] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [isAdminRoute, setIsAdminRoute] = useState(false);

  // Exponer BACKEND_URL (tu env: VITE_REACT_APP_BACKEND_URL)
  useEffect(() => {
    const be =
      (typeof import.meta !== 'undefined' && import.meta.env &&
        (import.meta.env.VITE_REACT_APP_BACKEND_URL || import.meta.env.VITE_BACKEND_URL)) ||
      (typeof process !== 'undefined' && process.env && process.env.REACT_APP_BACKEND_URL) ||
      'https://cerro-largo-backend.onrender.com';
    if (typeof window !== 'undefined') window.BACKEND_URL = be;
  }, []);

  // Mostrar AdminPanel solo en /admin
  useEffect(() => {
    const compute = () => {
      const path = (typeof window !== 'undefined' && window.location && window.location.pathname) || '';
      setIsAdminRoute(/^\/admin\/?$/.test(path));
    };
    compute();
    window.addEventListener('popstate', compute);
    return () => window.removeEventListener('popstate', compute);
  }, []);

  // === Geolocalización (igual al código que te funcionaba antes) ===
  useEffect(() => {
    const getInitialLocation = () => {
      if (!navigator.geolocation) {
        const fallback = { lat: -32.3667, lng: -54.1667 };
        setUserLocation(fallback);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        () => {
          // Fallback Cerro Largo
          setUserLocation({ lat: -32.3667, lng: -54.1667 });
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 min
        }
      );
    };
    getInitialLocation();
  }, []);

  // Callbacks (sin cambios)
  const handleZoneStatesLoad = (initialStates) => setZoneStates(initialStates || {});
  const handleZonesLoad = (zonesList) => Array.isArray(zonesList) && setZones(zonesList);

  const handleZoneStateChange = (zoneName, newStateEn) => {
    setZoneStates((prev) => ({ ...prev, [zoneName]: newStateEn }));
  };

  const handleBulkZoneStatesUpdate = (updated) => {
    if (updated && typeof updated === 'object') {
      setZoneStates((prev) => ({ ...prev, ...updated }));
    }
  };

  const handleRefreshZoneStates = async () => {
    try {
      const be = (typeof window !== 'undefined' && window.BACKEND_URL) || 'https://cerro-largo-backend.onrender.com';
      const res = await fetch(be.replace(/\/$/, '') + '/api/admin/zones/states', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json().catch(() => ({}));
      const map = {};
      if (data && data.states) {
        Object.entries(data.states).forEach(([name, info]) => {
          map[name] = (info && info.state) || 'red';
        });
      }
      setZoneStates(map);
    } catch (_) {}
  };

  const handleUserLocationChange = (loc) => {
    if (loc) setUserLocation(loc);
  };

  return (
    <div className="app-container">
      <MapComponent
        zones={zones}
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
          onZoneStateChange={handleZoneStateChange}
        />
      )}
    </div>
  );
}
