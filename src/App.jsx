// src/App.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

// Componentes
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

// ---------------------------- Util: BACKEND_URL ----------------------------
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

// ---------------------------- Home Page (Mapa) ----------------------------
function HomePage() {
  const BACKEND_URL = useBackendUrl();

  // Estados del mapa/paneles
  const [zoneStates, setZoneStates] = useState({});
  const [zones, setZones] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // NUEVO: alertas visibles (del backend) → se pintan en el mapa
  const [alerts, setAlerts] = useState([]);

  // Paneles / Modales
  const [reportOpen, setReportOpen] = useState(false);
  const [reportAnchorRect, setReportAnchorRect] = useState(null);
  const reportBtnRef = useRef(null);

  const [infoOpen, setInfoOpen] = useState(false);
  const [infoAnchorRect, setInfoAnchorRect] = useState(null);
  const infoBtnRef = useRef(null);

  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportModalAnchorRect, setReportModalAnchorRect] = useState(null);
  const reportFabRef = useRef(null);

  // Helpers
  const fetchJson = useCallback(async (url, options = {}) => {
    const res = await fetch(url, { credentials: "include", ...options });
    const ct = res.headers.get("content-type") || "";
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}: ${text.slice(0, 200)}`);
    if (!ct.includes("application/json")) throw new Error(`No-JSON: ${text.slice(0, 200)}`);
    try {
      return JSON.parse(text);
    } catch {
      return {};
    }
  }, []);

  // Geolocalización (fallback: Melo)
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

  // Cargar estados de zonas
  const handleRefreshZoneStates = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await fetchJson(`${BACKEND_URL}/api/admin/zones/states`);
      if (data?.success && data.states) {
        const mapping = {};
        Object.entries(data.states).forEach(([name, info]) => {
          mapping[name] = info?.state || "red";
        });
        setZoneStates(mapping);
      }
    } catch (e) {
      console.warn("No se pudo refrescar estados:", e.message);
    } finally {
      setRefreshing(false);
    }
  }, [BACKEND_URL, fetchJson]);

  const handleZoneStateChange = (zoneName, newStateEn) => {
    setZoneStates((prev) => ({ ...prev, [zoneName]: newStateEn }));
  };
  const handleBulkZoneStatesUpdate = (updatesMap) => {
    if (!updatesMap || typeof updatesMap !== "object") return;
    setZoneStates((prev) => ({ ...prev, ...updatesMap }));
  };
  const handleZonesLoad = (loadedZones) => {
    if (Array.isArray(loadedZones)) setZones(loadedZones);
  };
  const handleUserLocationChange = (loc) => {
    if (loc) setUserLocation(loc);
  };

  // Cargar alertas visibles (NUEVO)
  const loadAlerts = useCallback(async () => {
    try {
      const json = await fetchJson(`${BACKEND_URL}/api/reportes/visibles`);
      if (json?.ok && Array.isArray(json.reportes)) {
        setAlerts(
          json.reportes
            .filter((a) => a.latitud != null && a.longitud != null)
            .map((a) => ({
              id: a.id,
              lat: a.latitud,
              lng: a.longitud,
              titulo: a.nombre_lugar || "Reporte",
              descripcion: a.descripcion || "",
            }))
        );
      }
    } catch (e) {
      // silencioso
    }
  }, [BACKEND_URL, fetchJson]);

  useEffect(() => {
    loadAlerts();
    const t = setInterval(loadAlerts, 30000); // refrescar cada 30s
    return () => clearInterval(t);
  }, [loadAlerts]);

  // UI handlers
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

  const handleToggleReportModal = () => {
    const btn = reportFabRef.current;
    if (btn) setReportModalAnchorRect(btn.getBoundingClientRect());
    setReportModalOpen((prev) => !prev);
  };
  const closeReportModal = () => setReportModalOpen(false);

  return (
    <div className="relative w-full h-screen">
      {/* Botones barra superior */}
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

      {/* Mapa */}
      <MapComponent
        zones={zones}
        zoneStates={zoneStates}
        onZoneStatesLoad={(initialStates) => initialStates && setZoneStates(initialStates)}
        onZoneStateChange={handleZoneStateChange}
        onZonesLoad={handleZonesLoad}
        userLocation={userLocation}
        alerts={alerts}   // <--- NUEVO: marcadores de atención
      />

      {/* FABs inferior-izquierda */}
      <div
        className="fixed z-[1000] flex flex-col items-start gap-2"
        style={{
          bottom: "max(1rem, env(safe-area-inset-bottom, 1rem))",
          left: "max(1rem, env(safe-area-inset-left, 1rem))",
        }}
      >
        <InfoButton ref={infoBtnRef} onClick={toggleInfo} isOpen={infoOpen} />
        <ReportButton
          ref={reportFabRef}
          onClick={handleToggleReportModal}
          onLocationChange={handleUserLocationChange}
        />
      </div>

      {/* Paneles y modales */}
      <ReportHubPanel open={reportOpen} anchorRect={reportAnchorRect} onClose={closeReportPanel} />
      <InfoPanel open={infoOpen} anchorRect={infoAnchorRect} onClose={closeInfoPanel} buttonRef={infoBtnRef} />
      <ReportModal
        open={reportModalOpen}
        anchorRect={reportModalAnchorRect}
        onClose={closeReportModal}
        onLocationChange={handleUserLocationChange}
      />

      {/* Alertas y banner */}
      <AlertWidget />
      <SiteBanner />
    </div>
  );
}

// ---------------------------- App con Router ----------------------------
export default function App() {
  useBackendUrl(); // publica BACKEND_URL en window por si otros lo usan
export default function App() {
  useBackendUrl(); // publica BACKEND_URL en window por si otros lo usan

  // REGISTRO SW (una vez)
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const onLoad = () => navigator.serviceWorker.register('/sw.js').catch(() => {});
      window.addEventListener('load', onLoad);
      return () => window.removeEventListener('load', onLoad);
    }
  }, []);

  return (
    <BrowserRouter>
      {/* ... tus rutas ... */}
    </BrowserRouter>
  );
}

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />

        <Route
          path="/admin"
          element={
            <AdminPanel
              onRefreshZoneStates={() => {}}
              onBulkZoneStatesUpdate={() => {}}
              onZoneStateChange={() => {}}
            />
          }
        />

        <Route path="/admin/reportes" element={<ReportsPanel />} />

        <Route path="*" element={<HomePage />} />
      </Routes>
    </BrowserRouter>
  );
}
