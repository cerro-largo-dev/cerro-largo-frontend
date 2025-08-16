import React, { useCallback, useEffect, useMemo, useState } from 'react';
import MapComponent from './components/MapComponent';
import AdminPanel from './components/AdminPanel';
import ReportButton from './components/Reportes/ReportButton';   // FAB "Reportes ciudadanos" (abajo-izquierda)
import ReportHubButton from './components/ReportHubButton';       // ← NUEVO (arriba-derecha)
import ReportHubPanel from './components/ReportHubPanel';         // ← NUEVO (popover debajo del botón)
import SiteBanner from './components/SiteBanner';                 // Banner informativo (abajo-izquierda)
import './App.css';

export default function App() {
  const [zoneStates, setZoneStates] = useState({}); // { "ARÉVALO": "green", ... }
  const [zones, setZones] = useState([]);
  const [userLocation, setUserLocation] = useState(null);

  // Mostrar AdminPanel solo en /admin
  const [isAdminRoute, setIsAdminRoute] = useState(false);

  // NUEVO: estado del panel "Reporte" (popover arriba-derecha)
  const [reportOpen, setReportOpen] = useState(false);
  const [reportAnchorRect, setReportAnchorRect] = useState(null); // {top,right,bottom,left,width,height}

  // Exponer la URL del backend a todo el front (mismo patrón que venimos usando)
  useEffect(() => {
    const be =
      (typeof import.meta !== 'undefined' && import.meta.env &&
        (import.meta.env.VITE_REACT_APP_BACKEND_URL || import.meta.env.VITE_BACKEND_URL)) ||
      (typeof process !== 'undefined' && process.env &&
        (process.env.REACT_APP_BACKEND_URL || process.env.VITE_BACKEND_URL)) ||
      'https://cerro-largo-backend.onrender.com';
    if (typeof window !== 'undefined') window.BACKEND_URL = String(be).replace(/\/$/, '');
  }, []);

  // Helper para obtener el backend sin barra final
  const BACKEND_URL = useMemo(() => {
    const be =
      (typeof window !== 'undefined' && window.BACKEND_URL) ||
      (typeof import.meta !== 'undefined' && import.meta.env &&
        (import.meta.env.VITE_REACT_APP_BACKEND_URL || import.meta.env.VITE_BACKEND_URL)) ||
      (typeof process !== 'undefined' && process.env &&
        (process.env.REACT_APP_BACKEND_URL || process.env.VITE_BACKEND_URL)) ||
      'https://cerro-largo-backend.onrender.com';
    return String(be).replace(/\/$/, '');
  }, []);

  // Detectar si la ruta actual es /admin
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

  // Geolocalización con fallback (no bloquea UI)
  useEffect(() => {
    const FALLBACK = { lat: -32.3667, lng: -54.1667 };
    if (!navigator.geolocation) {
      setUserLocation(FALLBACK);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setUserLocation(FALLBACK),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  }, []);

  // ---- Utils JSON fetch con credenciales ----
  const fetchJson = useCallback(async (url, options = {}) => {
    const res = await fetch(url, { credentials: 'include', ...options });
    const ct = res.headers.get('content-type') || '';
    const text = await res.text();
    if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + res.statusText + ': ' + text.slice(0, 200));
    if (ct.indexOf('application/json') === -1) throw new Error('No-JSON: ' + text.slice(0, 200));
    try { return JSON.parse(text); } catch { return {}; }
  }, []);

  // ---- Callbacks que usan mapa y panel ----
  const handleZoneStateChange = (zoneName, newStateEn) => {
    // Actualiza de inmediato para reflejar en el mapa sin recargar
    setZoneStates((prev) => ({ ...prev, [zoneName]: newStateEn }));
  };

  const handleRefreshZoneStates = useCallback(async () => {
    try {
      const data = await fetchJson(BACKEND_URL + '/api/admin/zones/states');
      if (data?.success && data.states) {
        const mapping = {};
        Object.entries(data.states).forEach(([name, info]) => {
          mapping[name] = (info && info.state) || 'red';
        });
        setZoneStates(mapping);
      }
    } catch (e) {
      console.warn('No se pudo refrescar estados:', e.message);
    }
  }, [BACKEND_URL, fetchJson]);

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

  // ---- Nuevo: manejo del botón "Reporte" (arriba-derecha) ----
  const handleToggleReport = useCallback((isOpen, rect) => {
    setReportOpen(isOpen);
    if (isOpen && rect) {
      // guardamos solo lo necesario del DOMRect
      setReportAnchorRect({
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
    } else {
      setReportAnchorRect(null);
    }
  }, []);

  const handleCloseReport = useCallback(() => {
    setReportOpen(false);
    setReportAnchorRect(null);
  }, []);

  return (
    <div className="app-container">
      {/* Mapa principal */}
      <MapComponent
        zones={zones}
        zoneStates={zoneStates}
        onZoneStatesLoad={(initialStates) => initialStates && setZoneStates(initialStates)}
        onZoneStateChange={handleZoneStateChange}
        onZonesLoad={handleZonesLoad}
        userLocation={userLocation}
      />

      {/* Botón de Reportes ciudadanos (FAB abajo-izquierda) */}
      <ReportButton onLocationChange={handleUserLocationChange} />

      {/* Banner informativo (abajo, se alinea con el FAB existente) */}
      <SiteBanner />

      {/* NUEVO: Botón "Reporte" (arriba-derecha) y su panel */}
      <ReportHubButton open={reportOpen} onToggle={handleToggleReport} />
      <ReportHubPanel open={reportOpen} anchorRect={reportAnchorRect} onClose={handleCloseReport} />

      {/* Panel de administración solo en /admin */}
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
