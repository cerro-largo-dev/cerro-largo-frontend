import React, { useState, useEffect } from 'react';
import MapComponent from './components/MapComponent';
import AdminPanel from './components/AdminPanel';
import './App.css';
import ReportButton from './components/Reportes/ReportButton';

export default function App() {
  const [zoneStates, setZoneStates] = useState({});
  const [zones, setZones] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [isAdminRoute, setIsAdminRoute] = useState(false);

  // Exponer BACKEND_URL para el resto de la app
  useEffect(() => {
    const be =
      (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env.VITE_REACT_APP_BACKEND_URL || import.meta.env.VITE_BACKEND_URL)) ||
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

  // Geolocalización inicial
  useEffect(() => {
    if (!navigator.geolocation) {
      setUserLocation({ lat: -32.3667, lng: -54.1667 });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setUserLocation({ lat: -32.3667, lng: -54.1667 }),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  }, []);

  const BACKEND_URL =
    (typeof window !== 'undefined' && window.BACKEND_URL) ||
    (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_REACT_APP_BACKEND_URL) ||
    'https://cerro-largo-backend.onrender.com';

  const fetchJson = async function (url, options) {
    const res = await fetch(url, Object.assign({ credentials: 'include' }, options || {}));
    const ct = res.headers.get('content-type') || '';
    const text = await res.text();
    if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + res.statusText + ': ' + text.slice(0, 200));
    if (ct.indexOf('application/json') === -1) throw new Error('No-JSON: ' + text.slice(0, 200));
    return JSON.parse(text);
  };

  const handleZoneStatesLoad = (initial) => {
    if (initial && typeof initial === 'object') setZoneStates(initial);
  };
  const handleZonesLoad = (list) => {
    if (Array.isArray(list)) setZones(list);
  };
  const handleZoneStateChange = (zoneName, newState) => {
    setZoneStates(function (prev) {
      const next = Object.assign({}, prev);
      next[zoneName] = newState;
      return next;
    });
  };
  const handleBulkZoneStatesUpdate = (updates) => {
    if (updates && typeof updates === 'object') {
      setZoneStates(function (prev) { return Object.assign({}, prev, updates); });
    }
  };
  const handleRefreshZoneStates = async () => {
    try {
      const url = BACKEND_URL.replace(/\/$/, '') + '/api/admin/zones/states';
      const data = await fetchJson(url);
      if (data && data.success && data.states) {
        const map = {};
        for (const name in data.states) {
          if (Object.prototype.hasOwnProperty.call(data.states, name)) {
            map[name] = (data.states[name] && data.states[name].state) || 'red';
          }
        }
        setZoneStates(map);
      }
    } catch (e) {
      console.warn('No se pudo refrescar estados:', e.message);
    }
  };
  const handleUserLocationChange = (loc) => { if (loc) setUserLocation(loc); };

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
