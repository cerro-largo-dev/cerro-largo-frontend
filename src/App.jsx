import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MapComponent from './components/MapComponent';
import AdminPanel from './components/AdminPanel';
import ReportButton from './components/Reportes/ReportButton';   // FAB "Reportes ciudadanos" (abajo-izquierda)
import ReportHubPanel from './components/ReportHubPanel';         // Panel popover (Descargar / Suscribirme)
import SiteBanner from './components/SiteBanner';
import './App.css';

export default function App() {
  const [zoneStates, setZoneStates] = useState({});
  const [zones, setZones] = useState([]);
  const [userLocation, setUserLocation] = useState(null);

  // Mostrar AdminPanel solo en /admin
  const [isAdminRoute, setIsAdminRoute] = useState(false);

  // Panel “Reporte” (anclado al botón junto a “Actualizar mapa”)
  const [reportOpen, setReportOpen] = useState(false);
  const [reportAnchorRect, setReportAnchorRect] = useState(null);
  const reportBtnRef = useRef(null);

  // Loading para feedback en “Actualizar mapa”
  const [refreshing, setRefreshing] = useState(false);

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
    // Refleja el cambio inmediatamente en el mapa
    setZoneStates((prev) => ({ ...prev, [zoneName]: newStateEn }));
  };

  const handleRefreshZoneStates = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await fetchJson(BACKEND_URL + '/api/admin/zones/states');
      if (data?.success && data.states) {
        const mapping = {};
        Object.entries(data.states).forEach(([name, info]) => {
          // El mapa espera 'green' | 'yellow' | 'red'
          mapping[name] = (info && info.state) || 'red';
        });
        setZoneStates(mapping);
        // feedback en consola
        console.info('Estados actualizados desde backend:', mapping);
      } else {
        console.warn('Respuesta inesperada al refrescar:', data);
      }
    } catch (e) {
      console.warn('No se pudo refrescar estados:', e.message);
    } finally {
      setRefreshing(false);
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
      {/* Controles superiores: MISMAS DIMENSIONES, SIN EMOJIS, CON HOVER */}
      <div className="fixed top-4 right-4 z-[1000] flex gap-2">
        <button
          type="button"
          onClick={handleRefreshZoneStates}
          disabled={refreshing}
          title="Actualizar mapa"
          className={[
            // mismas dimensiones para ambos
            'h-11 min-w-[160px] px-4 rounded-xl shadow-lg font-semibold',
            // color y hover
            refreshing ? 'bg-green-500 cursor-wait' : 'bg-green-600 hover:bg-green-700',
            'text-white transition-colors'
          ].join(' ')}
        >
          {refreshing ? 'Actualizando…' : 'Actualizar mapa'}
        </button>

        <button
          type="button"
          ref={reportBtnRef}
          onClick={toggleReportPanel}
          aria-haspopup="dialog"
          aria-expanded={reportOpen ? 'true' : 'false'}
          aria-controls="report-hub-panel"
          title="Reporte"
          className={[
            // mismas dimensiones que el de actualizar
            'h-11 min-w-[160px] px-4 rounded-xl shadow-lg font-semibold',
            // color y hover (mismo patrón de cambio de tono)
            reportOpen ? 'bg-sky-700' : 'bg-sky-600 hover:bg-sky-700',
            'text-white transition-colors'
          ].join(' ')}
        >
          Reporte
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

      {/* FAB Reportes ciudadanos (abajo-izquierda) */}
      <ReportButton onLocationChange={handleUserLocationChange} />

      {/* Banner informativo (abajo-izquierda) */}
      <SiteBanner />

      {/* Panel “Reporte” anclado al botón */}
      <ReportHubPanel open={reportOpen} anchorRect={reportAnchorRect} onClose={closeReportPanel} />

      {/* Admin solo en /admin */}
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
