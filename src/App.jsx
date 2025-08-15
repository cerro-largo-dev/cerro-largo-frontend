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

  // Exponer BACKEND_URL
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

  // ---- GEO ROBUSTA ----
  const FALLBACK = { lat: -32.3667, lng: -54.1667 }; // Cerro Largo

  const tryOnce = (opts) =>
    new Promise((resolve, reject) => {
      if (!('geolocation' in navigator)) return reject(new Error('No geolocation'));
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => reject(err),
        opts
      );
    });

  const tryWatch = (opts, ms = 8000) =>
    new Promise((resolve, reject) => {
      if (!('geolocation' in navigator) || !navigator.geolocation.watchPosition) {
        return reject(new Error('No watch'));
      }
      let resolved = false;
      const id = navigator.geolocation.watchPosition(
        (pos) => {
          if (resolved) return;
          resolved = true;
          navigator.geolocation.clearWatch(id);
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        (err) => {
          if (resolved) return;
          resolved = true;
          navigator.geolocation.clearWatch(id);
          reject(err);
        },
        opts
      );
      setTimeout(() => {
        if (resolved) return;
        resolved = true;
        navigator.geolocation.clearWatch(id);
        reject(new Error('watch timeout'));
      }, ms);
    });

  const resolveLocation = useCallback(async () => {
    // 1) Alta precisión
    try {
      const loc = await tryOnce({ enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 });
      setUserLocation(loc);
      return true;
    } catch (e1) {
      // 2) Baja precisión si POSITION_UNAVAILABLE
      if (e1 && e1.code === 2) {
        try {
          const loc2 = await tryOnce({ enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 });
          setUserLocation(loc2);
          return true;
        } catch (e2) {
          // 3) watchPosition como último intento
          try {
            const loc3 = await tryWatch({ enableHighAccuracy: false, maximumAge: 300000 }, 10000);
            setUserLocation(loc3);
            return true;
          } catch {
            setUserLocation(FALLBACK);
            return false;
          }
        }
      } else {
        // Denied u otro error
        setUserLocation(FALLBACK);
        return false;
      }
    }
  }, []);

  // Intento al montar
  useEffect(() => {
    resolveLocation();
  }, [resolveLocation]);

  // Reintento en el primer gesto de usuario (iOS/Safari, Chrome agresivo)
  useEffect(() => {
    if (userLocation) return;
    const handler = () => resolveLocation();
    window.addEventListener('click', handler, { once: true });
    window.addEventListener('touchend', handler, { once: true });
    return () => {
      window.removeEventListener('click', handler);
      window.removeEventListener('touchend', handler);
    };
  }, [userLocation, resolveLocation]);

  // ---- Callbacks existentes ----
  const handleZoneStatesLoad = (initialStates) => {
    if (initialStates && typeof initialStates === 'object') setZoneStates(initialStates);
  };
  const handleZonesLoad = (zonesList) => { if (Array.isArray(zonesList)) setZones(zonesList); };
  const handleZoneStateChange = (zoneName, newStateEn) => {
    setZoneStates((prev) => ({ ...prev, [zoneName]: newStateEn }));
  };
  const handleBulkZoneStatesUpdate = (updatesMap) => {
    if (updatesMap && typeof updatesMap === 'object') setZoneStates((prev) => ({ ...prev, ...updatesMap }));
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
      {/* Reintenta al abrir el modal de reportes (gesto del usuario) */}
      <ReportButton onLocationChange={handleUserLocationChange} onEnsureLocation={resolveLocation} />
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
