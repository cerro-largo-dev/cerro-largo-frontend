// src/App.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";

import MapComponent from "./components/MapComponent";
import AdminPanel from "./components/AdminPanel";
import ReportButton from "./components/Reportes/ReportButton";
import ReportModal from "./components/Reportes/ReportModal";
import ReportHubPanel from "./components/ReportHubPanel";
import InfoButton from "./components/InfoButton";
import InfoPanel from "./components/InfoPanel";
import SiteBanner from "./components/SiteBanner";
import AlertWidget from "./components/AlertWidget";
import ReportsPanel from "./components/ReportsPanel";

import "./App.css";

// ---------------- util BACKEND_URL ----------------
function useBackendUrl() {
  useEffect(() => {
    const be =
      (typeof import.meta !== "undefined" &&
        import.meta.env &&
        (import.meta.env.VITE_REACT_APP_BACKEND_URL || import.meta.env.VITE_BACKEND_URL)) ||
      (typeof process !== "undefined" &&
        process.env &&
        (process.env.REACT_APP_BACKEND_URL || process.env.VITE_BACKEND_URL)) ||
      "https://cerro-largo-backend.onrender.com";
    if (typeof window !== "undefined") window.BACKEND_URL = String(be).replace(/\/$/, "");
  }, []);
  return useMemo(() => {
    const be =
      (typeof window !== "undefined" && window.BACKEND_URL) ||
      (typeof import.meta !== "undefined" &&
        import.meta.env &&
        (import.meta.env.VITE_REACT_APP_BACKEND_URL || import.meta.env.VITE_BACKEND_URL)) ||
      (typeof process !== "undefined" &&
        process.env &&
        (process.env.REACT_APP_BACKEND_URL || process.env.VITE_BACKEND_URL)) ||
      "https://cerro-largo-backend.onrender.com";
    return String(be).replace(/\/$/, "");
  }, []);
}

// ---------------- AppShell: mapa siempre montado ----------------
function AppShell() {
  const BACKEND_URL = useBackendUrl();
  const { pathname } = useLocation();

  // estados mapa/paneles
  const [zoneStates, setZoneStates] = useState({});
  const [zones, setZones] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [alerts, setAlerts] = useState([]);

  const [reportOpen, setReportOpen] = useState(false);
  const [reportAnchorRect, setReportAnchorRect] = useState(null);
  const reportBtnRef = useRef(null);

  const [infoOpen, setInfoOpen] = useState(false);
  const [infoAnchorRect, setInfoAnchorRect] = useState(null);
  const infoBtnRef = useRef(null);

  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportModalAnchorRect, setReportModalAnchorRect] = useState(null);
  const reportFabRef = useRef(null);

  const fetchJson = useCallback(async (url, options = {}) => {
    const res = await fetch(url, { credentials: "include", ...options });
    const ct = res.headers.get("content-type") || "";
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}: ${text.slice(0, 200)}`);
    if (!ct.includes("application/json")) throw new Error(`No-JSON: ${text.slice(0, 200)}`);
    try { return JSON.parse(text); } catch { return {}; }
  }, []);

  // geo
  useEffect(() => {
    const FALLBACK = { lat: -32.3667, lng: -54.1667 };
    if (!navigator.geolocation) { setUserLocation(FALLBACK); return; }
    navigator.geolocation.getCurrentPosition(
      (pos)=>setUserLocation({lat:pos.coords.latitude,lng:pos.coords.longitude}),
      ()=>setUserLocation(FALLBACK),
      { enableHighAccuracy:true, timeout:10000, maximumAge:300000 }
    );
  }, []);

  // zonas
  const handleRefreshZoneStates = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await fetchJson(`${BACKEND_URL}/api/admin/zones/states`);
      if (data?.success && data.states) {
        const m = {};
        Object.entries(data.states).forEach(([name, info]) => { m[name] = info?.state || "red"; });
        setZoneStates(m);
      }
    } finally { setRefreshing(false); }
  }, [BACKEND_URL, fetchJson]);

  const handleZoneStateChange = (zone, st) => setZoneStates(p => ({...p,[zone]:st}));
  const handleBulkZoneStatesUpdate = (u) => setZoneStates(p => ({...p, ...(u||{})}));
  const handleZonesLoad = (z) => Array.isArray(z) && setZones(z);
  const handleUserLocationChange = (loc) => loc && setUserLocation(loc);

  // alertas visibles
  const loadAlerts = useCallback(async () => {
    try {
      const json = await fetchJson(`${BACKEND_URL}/api/reportes/visibles`);
      if (json?.ok && Array.isArray(json.reportes)) {
        setAlerts(json.reportes
          .filter(a => a.latitud!=null && a.longitud!=null)
          .map(a => ({ id:a.id, lat:a.latitud, lng:a.longitud,
                       titulo:a.nombre_lugar||"Reporte", descripcion:a.descripcion||"" })));
      }
    } catch {}
  }, [BACKEND_URL, fetchJson]);

  useEffect(() => { loadAlerts(); const t=setInterval(loadAlerts,30000); return ()=>clearInterval(t); }, [loadAlerts]);

  // UI
  const toggleReportPanel = () => { const b=reportBtnRef.current; if(b) setReportAnchorRect(b.getBoundingClientRect()); setReportOpen(v=>!v); };
  const closeReportPanel = () => setReportOpen(false);
  const toggleInfo = () => { const b=infoBtnRef.current; if(b) setInfoAnchorRect(b.getBoundingClientRect()); setInfoOpen(v=>!v); };
  const closeInfoPanel = () => setInfoOpen(false);
  const handleToggleReportModal = () => { const b=reportFabRef.current; if(b) setReportModalAnchorRect(b.getBoundingClientRect()); setReportModalOpen(p=>!p); };
  const closeReportModal = () => setReportModalOpen(false);

  const isAdmin = /^\/admin(\/|$)/.test(pathname);
  const isAdminReportes = pathname === "/admin/reportes";

  return (
    <div className="relative w-full h-screen">
      {/* barra superior */}
      <div className="absolute top-4 right-4 z-[1000] flex gap-2">
        <button
          onClick={handleRefreshZoneStates}
          className="bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-green-700 disabled:opacity-50"
          disabled={refreshing}
          title="Actualizar Mapa"
        >
          {refreshing ? "Actualizando..." : "Actualizar Mapa"}
        </button>

        <button
          ref={reportBtnRef}
          onClick={toggleReportPanel}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-blue-700"
          title="Reporte"
        >
          Reporte
        </button>
      </div>

      {/* Mapa SIEMPRE */}
      <MapComponent
        zones={zones}
        zoneStates={zoneStates}
        onZoneStatesLoad={(s)=>s && setZoneStates(s)}
        onZoneStateChange={handleZoneStateChange}
        onZonesLoad={handleZonesLoad}
        userLocation={userLocation}
        alerts={alerts}
      />

      {/* FABs */}
      <div className="fixed z-[1000] flex flex-col items-start gap-2"
           style={{ bottom:"max(1rem, env(safe-area-inset-bottom, 1rem))",
                    left:"max(1rem, env(safe-area-inset-left, 1rem))" }}>
        <InfoButton ref={infoBtnRef} onClick={toggleInfo} isOpen={infoOpen}/>
        <ReportButton ref={reportFabRef} onClick={handleToggleReportModal} onLocationChange={handleUserLocationChange}/>
      </div>

      {/* Paneles comunes */}
      <ReportHubPanel open={reportOpen} anchorRect={reportAnchorRect} onClose={closeReportPanel}/>
      <InfoPanel open={infoOpen} anchorRect={infoAnchorRect} onClose={closeInfoPanel} buttonRef={infoBtnRef}/>
      <ReportModal open={reportModalOpen} anchorRect={reportModalAnchorRect} onClose={closeReportModal} onLocationChange={handleUserLocationChange}/>

      {/* Overlays ADMIN encima del mapa */}
      {isAdmin && !isAdminReportes && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="pointer-events-auto">
            <AdminPanel
              onRefreshZoneStates={handleRefreshZoneStates}
              onBulkZoneStatesUpdate={handleBulkZoneStatesUpdate}
              onZoneStateChange={handleZoneStateChange}
            />
          </div>
        </div>
      )}

      {isAdminReportes && (
        <div className="absolute inset-0 bg-transparent pointer-events-none">
          <div className="pointer-events-auto">
            <ReportsPanel />
          </div>
        </div>
      )}

      <AlertWidget />
      <SiteBanner />
    </div>
  );
}

// ---------------- Router ----------------
export default function App() {
  useBackendUrl();
  return (
    <BrowserRouter>
      {/* el mapa vive en AppShell y las rutas solo controlan overlays */}
      <Routes>
        <Route path="/*" element={<AppShell />} />
      </Routes>
    </BrowserRouter>
  );
}
