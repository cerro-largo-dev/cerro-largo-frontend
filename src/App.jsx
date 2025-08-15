import React, { useEffect, useState, useCallback } from 'react';
import MapComponent from './components/MapComponent';
import AdminPanel from './components/AdminPanel';
import ReportButton from './components/Reportes/ReportButton';
import SiteBanner from './components/SiteBanner';
import './App.css';

export default function App() {
  const [zoneStates, setZoneStates] = useState({}); // { "ARÉVALO": "green", ... }
  const [zones, setZones] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [isAdminRoute, setIsAdminRoute] = useState(false);

  // Exponer la URL del backend para todos los componentes
  useEffect(() => {
    const be =
      (typeof import.meta !== 'undefined' && import.meta.env &&
        (import.meta.env.VITE_REACT_APP_BACKEND_URL || import.meta.env.VITE_BACKEND_URL)) ||
      (typeof process !== 'undefined' && process.env &&
        (process.env.REACT_APP_BACKEND_URL || process.env.VITE_BACKEND_URL)) ||
      'https://cerro-largo-backend.onrender.com';
    if (typeof window !== 'undefined') window.BACKEND_URL = String(be).replace(/\/$/, '');
  }, []);

  // Helper para usar la URL del backend sin barra final
  const backend = useCallback(() => {
    const be =
      (typeof window !== 'undefined' && window.BACKEND_URL) ||
      (typeof import.meta !== 'undefined' && import.meta.env &&
        (import.meta.env.VITE_REACT_APP_BACKEND_URL || import.meta.env.VITE_BACKEND_URL)) ||
      (typeof process !== 'undefined' && process.env &&
        (process.env.REACT_APP_BACKEND_URL || process.env.VITE_BACKEND_URL)) ||
      'https://cerro-largo-backend.onrender.com';
    return String(be).replace(/\/$/, '');
  }, []);

  // Mostrar AdminPanel solo en /admin
  useEffect(() => {
    const compute = () => {
      try {
        const path =
          (typeof window !== 'undefined' && window.location && window.location.pathname) || '';
        setIsAdminRoute(/^\/admin\/?$/.test(path));
      } catch {
        setIsAdminRoute(false);
      }
    };
    compute();
    window.addEventListener('popstate', compute);
    return () => window.removeEventListener('popstate', compute);
  }, []);

  // Geolocalización con fallback
  useEffect(() => {
    const FALLBACK = { lat: -32.3667, lng: -54.1667 };
    if (!navigator.geolocation) {
      setUserLocation(FALLBACK);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => setUserLocation(FALLBACK),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  }, []);

  // --- Utilidad fetch JSON (con credenciales y chequeo de JSON) ---
  const fetchJson = async (url, options = {}) => {
    const res = await fetch(url, { credentials: 'include', ...options });
    const ct = res.headers.get('content-type') || '';
    const text = await res.text();
    if (!res.ok) {
      throw new Error('HTTP ' + res.status + ' ' + res.statusText + ': ' + text.slice(0, 200));
    }
    if (ct.indexOf('application/json') === -1) {
      throw new Error('No-JSON: ' + text.slice(0, 200));
    }
    try {
      return JSON.parse(text);
    } catch {
      return {};
    }
  };

  // --- Callbacks que usa el mapa y el panel ---
  const handleZoneStateChange = (zoneName, newStateEn) => {
    // Actualiza inmediatamente para reflejarlo en el mapa sin recargar
    setZoneStates((prev) => ({ ...prev, [zoneName]: newStateEn }));
  };

  const handleRefreshZoneStates = async () => {
    try {
      const data = await fetchJson(backend() + '/api/admin/zones/states');
      if (data && data.states) {
        const mapping = {};
        Object.entries(data.states).forEach(([name, info]) => {
          mapping[name] = (info && info.state) || 'red';
        });
        setZoneStates(mapping);
      }
    } catch (e) {
      console.warn('No se pudo refrescar estados:', e.message);
    }
  };

  const handleBulkZoneStatesUpdate = (updatesMap) => {
    if (!updatesMap || typeof updatesMap !== 'object') return;
    setZoneStates((prev) => ({ ...prev, ...updatesMap }));
  };

  const handleZonesLoad = (loadedZones) => {
    if (Array.isArray(loadedZones)) setZones(loadedZones);
  };

  const handleUserLocationChange = (loc) => {
    if (loc) setUserLocation(loc);
  };

  return (
    <div className="app-container">
      <MapComponent
        zones={zones}
        zoneStates={zoneStates}
        onZoneStatesLoad={(initialStates) => initialStates && setZoneStates(initialStates)}
        onZoneStateChange={handleZoneStateChange}
        onZonesLoad={handleZonesLoad}
        userLocation={userLocation}
      />

      {/* UI superior derecha */}
      <ReportButton onLocationChange={handleUserLocationChange} />
      <SiteBanner />

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
