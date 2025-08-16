import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MapComponent from './components/MapComponent';
import AdminPanel from './components/AdminPanel';
import ReportButton from './components/Reportes/ReportButton';   // FAB "Reportes ciudadanos" (abajo-izquierda)
import ReportHubPanel from './components/ReportHubPanel';         // Panel popover (Descargar / Suscribirme)
import SiteBanner from './components/SiteBanner';
import './App.css';

export default function App() {
  const [zoneStates, setZoneStates] = useState({}); // { "ARÉVALO": "green", ... }
  const [zones, setZones] = useState([]);
  const [userLocation, setUserLocation] = useState(null);

  // Admin solo en /admin
  const [isAdminRoute, setIsAdminRoute] = useState(false);

  // Panel “Reporte” (anclado al botón junto a “Actualizar Mapa”)
  const [reportOpen, setReportOpen] = useState(false);
  const [reportAnchorRect, setReportAnchorRect] = useState(null);
  const reportBtnRef = useRef(null);

  // Exponer BACKEND_URL global
  useEffect(() => {
    const be =
      (typeof import.meta !== 'undefined' && import.meta.env &&
        (import.meta.env.VITE_REACT_APP_BACKEND_URL || import.meta.env.VITE_BACKEND_URL)) ||
      (typeof process !== 'undefined' && process.env &&
        (process.env.REACT_APP_BACKEND_URL || process.env.VITE_BACKEND_URL)) ||
      'https://cerro-largo-backend.onrender.com';
    if (typeof window !== 'undefined') window.BACKEND_URL = String(be).replace(/\/$/, '');
  }, []);

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

  // Detectar ruta /admin
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

  // Geolocalización con fallback
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

  // Utils
  const fetchJson = useCallback(async (url, options = {}) => {
    const res = await fetch(url, { credentials: 'include', ...options });
    const ct = res.headers.get('content-type') || '';
    const text = await res.text();
    if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + res.statusText + ': ' + text.slice(0, 200));
    if (ct.indexOf('application/json') === -1) throw new Error('No-JSON: ' + text.slice(0, 200));
    try { return JSON.parse(text); } catch { return {}; }
  }, []);

  // Callbacks de mapa/panel
  const handleZoneStateChange = (zoneName, newStateEn) => {
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

  // Toggle panel “Reporte”
  const toggleReportPanel = () => {
    const btn = reportBtnRef.current;
    if (btn) {
      const rect = btn.getBoundingClientRect();
      setReportAnchorRect({
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
    }
    setReportOpen((v) => !v);
  };

  const closeReportPanel = () => {
    setReportOpen(false);
    setReportAnchorRect(null);
  };

  return (
    <div className="app-container">
      {/* Controles superiores: EXACTAMENTE donde estaban antes */}
      <div className="fixed top-4 right-4 z-[1000] flex gap-2">
        <button
          type="button"
          className="bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-green-700 disabled:opacity-50"
          onClick={handleRefreshZoneStates}
          title="Actualizar Mapa"
        >
          🔄 Actualizar Mapa
        </button>

        {/* MISMA forma/estilo del botón previo */}
        <button
          type="button"
          ref={reportBtnRef}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-blue-700 disabled:opacity-50"
          onClick={toggleReportPanel}
          aria-haspopup="dialog"
          aria-expanded={reportOpen ? 'true' : 'false'}
          aria-controls="report-hub-panel"
          title="Reporte"
        >
          📄 Reporte
        </button>
      </div>

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

      {/* Banner informativo (abajo-izquierda) */}
      <SiteBanner />

      {/* Panel “Reporte” anclado al botón de arriba */}
      <ReportHubPanel open={reportOpen} anchorRect={reportAnchorRect} onClose={closeReportPanel} />

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
