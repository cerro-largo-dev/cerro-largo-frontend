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

  // Exponer BACKEND_URL (tu env: VITE_REACT_APP_BACKEND_URL)
  useEffect(() => {
    const be =
      (typeof import.meta !== 'undefined' && import.meta.env &&
        (import.meta.env.VITE_REACT_APP_BACKEND_URL || import.meta.env.VITE_BACKEND_URL)) ||
      (typeof process !== 'undefined' && process.env && process.env.REACT_APP_BACKEND_URL) ||
      'https://cerro-largo-backend.onrender.com';
    if (typeof window !== 'undefined') window.BACKEND_URL = String(be).replace(/\/$/, '');
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

  // -------- GEO “DES-EMPAQUETADA” --------
  const FALLBACK = { lat: -32.3667, lng: -54.1667 }; // Cerro Largo

  const gpOnce = (opts) =>
    new Promise((res, rej) => {
      if (!('geolocation' in navigator)) return rej(new Error('no-geolocation'));
      navigator.geolocation.getCurrentPosition(
        (p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }),
        (e) => rej(e),
        opts
      );
    });

  const gpWatch = (opts, ms = 8000) =>
    new Promise((res, rej) => {
      if (!('geolocation' in navigator) || !navigator.geolocation.watchPosition) return rej(new Error('no-watch'));
      let done = false;
      const id = navigator.geolocation.watchPosition(
        (p) => {
          if (done) return;
          done = true;
          navigator.geolocation.clearWatch(id);
          res({ lat: p.coords.latitude, lng: p.coords.longitude });
        },
        (e) => {
          if (done) return;
          done = true;
          navigator.geolocation.clearWatch(id);
          rej(e);
        },
        opts
      );
      setTimeout(() => {
        if (done) return;
        done = true;
        navigator.geolocation.clearWatch(id);
        rej(new Error('watch-timeout'));
      }, ms);
    });

  const resolveLocation = useCallback(async () => {
    // 1) Alta precisión
    try {
      const l1 = await gpOnce({ enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 });
      setUserLocation(l1);
      return;
    } catch (e1) {
      // 2) Baja precisión si POSITION_UNAVAILABLE (code 2) o cualquier fallo
      try {
        const l2 = await gpOnce({ enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 });
        setUserLocation(l2);
        return;
      } catch (e2) {
        // 3) Último intento: watchPosition (a veces “despierta” proveedores)
        try {
          const l3 = await gpWatch({ enableHighAccuracy: false, maximumAge: 300000 }, 10000);
          setUserLocation(l3);
          return;
        } catch (_) {
          // 4) Fallback
          setUserLocation(FALLBACK);
          return;
        }
      }
    }
  }, []);

  // Pídelo al montar (sin esperar gestos)
  useEffect(() => {
    resolveLocation();
  }, [resolveLocation]);
  // -------- FIN GEO --------

  // Callbacks existentes
  const handleZoneStatesLoad = (initialStates) => {
    if (initialStates && typeof initialStates === 'object') setZoneStates(initialStates);
  };
  const handleZonesLoad = (zonesList) => { if (Array.isArray(zonesList)) setZones(zonesList); };

  const handleZoneStateChange = (zoneName, newStateEn) => {
    // Refresco inmediato del mapa
    setZoneStates((prev) => ({ ...prev, [zoneName]: newStateEn }));
  };

  const handleBulkZoneStatesUpdate = (updatesMap) => {
    if (updatesMap && typeof updatesMap === 'object') {
      setZoneStates((prev) => ({ ...prev, ...updatesMap }));
    }
  };

  const handleRefreshZoneStates = async () => {
    try {
      const be = (typeof window !== 'undefined' && window.BACKEND_URL) || 'https://cerro-largo-backend.onrender.com';
      const url = String(be).replace(/\/$/, '') + '/api/admin/zones/states';
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
