import React, { useState, useEffect, useCallback } from 'react';
import MapComponent from './components/MapComponent';
import AdminPanel from './components/AdminPanel';
import ReportButton from './components/Reportes/ReportButton';
import './App.css';

export default function App() {
  const [zoneStates, setZoneStates] = useState({});
  const [zones, setZones] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [isAdminRoute, setIsAdminRoute] = useState(false);

  // Exponer BACKEND_URL al window para que lo usen otros componentes
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
    const compute = function () {
      try {
        const path = (typeof window !== 'undefined' && window.location && window.location.pathname) || '';
        setIsAdminRoute(/^\/admin\/?$/.test(path));
      } catch (e) {
        setIsAdminRoute(false);
      }
    };
    compute();
    window.addEventListener('popstate', compute);
    return () => window.removeEventListener('popstate', compute);
  }, []);

  // === GEOLOCALIZACIÓN ===
  // 1) función reutilizable para pedir ubicación
  const requestLocation = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setUserLocation({ lat: -32.3667, lng: -54.1667 }); // Cerro Largo (fallback)
      return false;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setUserLocation({ lat: -32.3667, lng: -54.1667 }),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
    return true;
  }, []);

  // 2) intento al montar
  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  // 3) si no hay ubicación, reintenta en el primer gesto del usuario (iOS/Safari)
  useEffect(() => {
    if (userLocation) return;
    const handler = () => requestLocation();
    window.addEventListener('click', handler, { once: true });
    window.addEventListener('touchend', handler, { once: true });
    window.addEventListener('keydown', handler, { once: true });
    return () => {
      window.removeEventListener('click', handler);
      window.removeEventListener('touchend', handler);
      window.removeEventListener('keydown', handler);
    };
  }, [userLocation, requestLocation]);

  // Handlers/Callbacks
  const handleZoneStatesLoad = (initialStates) => {
    if (initialStates && typeof initialStates === 'object') setZoneStates(initialStates);
  };

  const handleZonesLoad = (zonesList) => {
    if (Array.isArray(zonesList)) setZones(zonesList);
  };

  // Refresco instantáneo del mapa cuando AdminPanel cambia un estado
  const handleZoneStateChange = (zoneName, newStateEn) => {
    setZoneStates((prev) => {
      const next = { ...prev };
      next[zoneName] = newStateEn;
      return next;
    });
  };

  const handleBulkZoneStatesUpdate = (updatesMap) => {
    if (updatesMap && typeof updatesMap === 'object') {
      setZoneStates((prev) => ({ ...prev, ...updatesMap }));
    }
  };

  const handleRefreshZoneStates = async () => {
    try {
      const be = (typeof window !== 'undefined' && window.BACKEND_URL) || 'https://cerro-largo-backend.onrender.com';
      const url = be.replace(/\/$/, '') + '/api/admin/zones/states';
      const res = await fetch(url, { credentials: 'include' });
      const ct = res.headers.get('content-type') || '';
      const txt = await res.text();
      if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + res.statusText + ': ' + txt.slice(0, 200));
      if (ct.indexOf('application/json') === -1) throw new Error('No-JSON: ' + txt.slice(0, 200));
      const data = JSON.parse(txt);
      const map = {};
      if (data && data.states) {
        for (const name in data.states) {
          if (Object.prototype.hasOwnProperty.call(data.states, name)) {
            map[name] = (data.states[name] && data.states[name].state) || 'red';
          }
        }
      }
      setZoneStates(map);
    } catch (e) {
      console.warn('No se pudo refrescar estados:', e.message);
    }
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

      {/* Reintenta pedir ubicación cuando se abre el modal de reportes */}
      <ReportButton onLocationChange={handleUserLocationChange} onEnsureLocation={requestLocation} />

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
