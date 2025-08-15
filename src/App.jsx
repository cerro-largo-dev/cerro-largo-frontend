import React, { useEffect, useState, useCallback } from 'react';
import MapComponent from './components/MapComponent';
import AdminPanel from './components/AdminPanel';
import ReportButton from './components/Reportes/ReportButton';
import './App.css';

export default function App() {
  const [zoneStates, setZoneStates] = useState({}); // { "ARÉVALO": "green", ... }
  const [zones, setZones] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [isAdminRoute, setIsAdminRoute] = useState(false);

  // Exponer la URL del backend para otros componentes (coincide con tu patrón Vite)
  useEffect(() => {
    const be = (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env.VITE_REACT_APP_BACKEND_URL || import.meta.env.VITE_BACKEND_URL)) ||
               (typeof process !== 'undefined' && process.env && (process.env.REACT_APP_BACKEND_URL || process.env.VITE_BACKEND_URL)) ||
               'https://cerro-largo-backend.onrender.com';
    if (typeof window !== 'undefined') window.BACKEND_URL = String(be).replace(/\/$/, '');
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

  // ---------------- Geolocalización robusta (evita TIMEOUT y POSITION_UNAVAILABLE) ----------------
  const FALLBACK = { lat: -32.3667, lng: -54.1667 }; // Cerro Largo

  const gpOnce = (opts) => new Promise((res, rej) => {
    if (!('geolocation' in navigator)) return rej(new Error('no-geolocation'));
    navigator.geolocation.getCurrentPosition(
      (p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (e) => rej(e),
      opts
    );
  });

  const watchOnce = (opts, ms = 10000) => new Promise((res, rej) => {
    if (!('geolocation' in navigator) || !navigator.geolocation.watchPosition) return rej(new Error('no-watch'));
    let done = false;
    const id = navigator.geolocation.watchPosition(
      (p) => { if (done) return; done = true; navigator.geolocation.clearWatch(id); res({ lat: p.coords.latitude, lng: p.coords.longitude }); },
      (e) => { if (done) return; done = true; navigator.geolocation.clearWatch(id); rej(e); },
      opts
    );
    setTimeout(() => { if (done) return; done = true; navigator.geolocation.clearWatch(id); rej(new Error('watch-timeout')); }, ms);
  });

  const getLocationRacer = useCallback(async () => {
    try {
      // Carrera: baja precisión (rápida) vs alta precisión (más exacta)
      const low = gpOnce({ enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 });
      const high = gpOnce({ enableHighAccuracy: true, timeout: 25000, maximumAge: 300000 });
      const first = await Promise.race([low, high]);
      setUserLocation(first);
      // Si luego llega la de alta precisión, la usamos para refinar sin bloquear la UI
      high.then((precise) => setUserLocation((cur) => cur || precise)).catch(() => {});
    } catch (e1) {
      // Respaldo: watchPosition (suele “despertar” proveedores)
      try {
        const loc = await watchOnce({ enableHighAccuracy: false, maximumAge: 300000 }, 10000);
        setUserLocation(loc);
      } catch (e2) {
        // Fallback Cerro Largo
        setUserLocation(FALLBACK);
      }
    }
  }, []);

  useEffect(() => { getLocationRacer(); }, [getLocationRacer]);
  // -----------------------------------------------------------------------------------------------

  // --- Utilidades de red ---
  const BACKEND_URL = (typeof window !== 'undefined' && window.BACKEND_URL) || 'https://cerro-largo-backend.onrender.com';

  const fetchJson = async (url, options = {}) => {
    const res = await fetch(url, { credentials: 'include', ...options });
    const ct = res.headers.get('content-type') || '';
    const text = await res.text();
    if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + res.statusText + ': ' + text.slice(0, 200));
    if (ct.indexOf('application/json') === -1) throw new Error('No-JSON: ' + text.slice(0, 200));
    try { return JSON.parse(text); } catch { return {}; }
  };

  // --- Callbacks que usa el mapa y el panel ---
  const handleZoneStateChange = (zoneName, newStateEn) => {
    // Refresca inmediatamente el color en el mapa sin recargar
    setZoneStates((prev) => ({ ...prev, [zoneName]: newStateEn }));
  };

  const handleRefreshZoneStates = async () => {
    try {
      const data = await fetchJson(BACKEND_URL.replace(/\/$/, '') + '/api/admin/zones/states');
      if (data && data.states) {
        const mapping = {};
        Object.entries(data.states).forEach(([name, info]) => { mapping[name] = (info && info.state) || 'red'; });
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

  const handleZonesLoad = (loadedZones) => { if (Array.isArray(loadedZones)) setZones(loadedZones); };
  const handleUserLocationChange = (loc) => { if (loc) setUserLocation(loc); };

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
