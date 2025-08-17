import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// Importación de componentes
import MapComponent from './components/MapComponent';
import AdminPanel from './components/AdminPanel';
import ReportButton from './components/Reportes/ReportButton'; // Asegúrate que la ruta es correcta
import ReportModal from './components/Reportes/ReportModal';   // Asegúrate que la ruta es correcta
import ReportHubPanel from './components/ReportHubPanel';
import InfoButton from './components/InfoButton';
import InfoPanel from './components/InfoPanel';
import SiteBanner from './components/SiteBanner';

// Estilos
import './App.css';

export default function App() {
  // Estados existentes
  const [zoneStates, setZoneStates] = useState({});
  const [zones, setZones] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [isAdminRoute, setIsAdminRoute] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Estados para paneles y modales
  const [reportOpen, setReportOpen] = useState(false); // Para el panel de "Reporte" superior
  const [reportAnchorRect, setReportAnchorRect] = useState(null);
  const reportBtnRef = useRef(null);

  const [infoOpen, setInfoOpen] = useState(false); // Para el panel de "Info"
  const [infoAnchorRect, setInfoAnchorRect] = useState(null);
  const infoBtnRef = useRef(null);

  // --- NUEVO: Estado para el modal de reporte del FAB ---
  const [reportModalOpen, setReportModalOpen] = useState(false);

  // Publicar BACKEND_URL
  useEffect(() => {
    const be =
      (typeof import.meta !== 'undefined' && import.meta.env &&
        (import.meta.env.VITE_REACT_APP_BACKEND_URL || import.meta.env.VITE_BACKEND_URL)) ||
      (typeof process !== 'undefined' && process.env &&
        (process.env.REACT_APP_BACKEND_URL || process.env.VITE_BACKEND_URL)) ||
      'https://cerro-largo-backend.onrender.com';
    if (typeof window !== 'undefined' ) window.BACKEND_URL = String(be).replace(/\/$/, '');
  }, []);

  const BACKEND_URL = useMemo(() => {
    const be =
      (typeof window !== 'undefined' && window.BACKEND_URL) ||
      (typeof import.meta !== 'undefined' && import.meta.env &&
        (import.meta.env.VITE_REACT_APP_BACKEND_URL || import.meta.env.VITE_BACKEND_URL)) ||
      (typeof process !== 'undefined' && process.env &&
        (process.env.REACT_APP_BACKEND_URL || process.env.VITE_BACKEND_URL)) ||
      'https://cerro-largo-backend.onrender.com';
    return String(be ).replace(/\/$/, '');
  }, []);

  // Detectar /admin
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

  const fetchJson = useCallback(async (url, options = {}) => {
    const res = await fetch(url, { credentials: 'include', ...options });
    const ct = res.headers.get('content-type') || '';
    const text = await res.text();
    if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + res.statusText + ': ' + text.slice(0, 200));
    if (!ct.includes('application/json')) throw new Error('No-JSON: ' + text.slice(0, 200));
    try { return JSON.parse(text); } catch { return {}; }
  }, []);

  const handleZoneStateChange = (zoneName, newStateEn) => {
    setZoneStates((prev) => ({ ...prev, [zoneName]: newStateEn }));
  };

  const handleRefreshZoneStates = useCallback(async () => {
    setRefreshing(true);
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

  // --- Funciones para los paneles y modales ---

  const toggleReportPanel = () => {
    const btn = reportBtnRef.current;
    if (btn) setReportAnchorRect(btn.getBoundingClientRect());
    setReportOpen((v) => !v);
  };

  const closeReportPanel = () => setReportOpen(false);

  const toggleInfo = () => {
    const btn = infoBtnRef.current;
    if (btn) setInfoAnchorRect(btn.getBoundingClientRect());
    setInfoOpen((v) => !v);
  };

  const closeInfoPanel = () => setInfoOpen(false);

  // --- NUEVA: Función para abrir/cerrar el modal de reporte del FAB ---
  const handleToggleReportModal = () => {
    setReportModalOpen((prev) => !prev);
  };

  return (
    <div className="relative w-full h-screen">
      {/* Botones de control superior derecho */}
      <div className="absolute top-4 right-4 z-[1000] flex gap-2">
        <button
          onClick={handleRefreshZoneStates}
          className="bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-green-700 disabled:opacity-50"
          disabled={refreshing}
          title="Actualizar Mapa"
        >
          {refreshing ? 'Actualizando...' : 'Actualizar Mapa'}
        </button>

        <button
          ref={reportBtnRef}
          onClick={toggleReportPanel}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-blue-700 disabled:opacity-50"
          title="Reporte"
        >
          Reporte
        </button>
      </div>

      {/* Mapa */}
      <MapComponent
        zones={zones}
        zoneStates={zoneStates}
        onZoneStatesLoad={(initialStates) => initialStates && setZoneStates(initialStates)}
        onZoneStateChange={handleZoneStateChange}
        onZonesLoad={handleZonesLoad}
        userLocation={userLocation}
      />

      {/* --- CORREGIDO: FABs abajo-izquierda --- */}
      <div className="absolute bottom-4 left-4 z-[1000] flex flex-col items-start gap-4">
        {/* El orden visual es vertical: ReportButton arriba, InfoButton abajo */}
        <ReportButton onClick={handleToggleReportModal} />
        <InfoButton ref={infoBtnRef} onClick={toggleInfo} />
      </div>

      {/* Paneles y Modales */}
      <ReportHubPanel open={reportOpen} anchorRect={reportAnchorRect} onClose={closeReportPanel} />
      <InfoPanel open={infoOpen} anchorRect={infoAnchorRect} onClose={closeInfoPanel} />
      
      {/* --- NUEVO: Renderizado del modal de reporte --- */}
      <ReportModal
        isOpen={reportModalOpen}
        onClose={handleToggleReportModal}
        onLocationChange={handleUserLocationChange}
      />

      {/* Banner informativo */}
      <SiteBanner />

      {/* Panel de administración */}
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
