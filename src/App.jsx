// src/App.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./App.css";

import MapComponent from "./components/MapComponent";
import AdminPanel from "./components/AdminPanel";
import ReportButton from "./components/Reportes/ReportButton";
import ReportModal from "./components/Reportes/ReportModal";
import ReportHubPanel from "./components/ReportHubPanel";
import InfoButton from "./components/InfoButton";
import InfoPanel from "./components/InfoPanel";
import SiteBanner from "./components/SiteBanner";
// import AlertWidget from "./components/AlertWidget";
import ReportsPanel from "./components/ReportsPanel";

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
  useBackendUrl(); // publica BACKEND_URL en window

  // Estado global
  const [zoneStates, setZoneStates] = useState({});
  const [zones, setZones] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [alerts, setAlerts] = useState([]);

  // Geolocalización en vivo
  const geoWatchIdRef = useRef(null);
  const [geoError, setGeoError] = useState("");

  const startLiveLocation = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setGeoError("La geolocalización no está soportada en este navegador");
      setUserLocation({ lat: -32.3667, lng: -54.1667 });
      return;
    }
    if (geoWatchIdRef.current != null) return; // ya mirando

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setGeoError("");
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        setGeoError("No se pudo obtener GPS; usando ubicación aproximada de Cerro Largo.");
        setUserLocation({ lat: -32.3667, lng: -54.1667 });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
    geoWatchIdRef.current = id;
  }, []);

  // Limpieza al cerrar/recargar la página (no al cerrar paneles)
  useEffect(() => {
    const cleanup = () => {
      if (geoWatchIdRef.current != null) {
        try { navigator.geolocation.clearWatch(geoWatchIdRef.current); } catch {}
        geoWatchIdRef.current = null;
      }
    };
    window.addEventListener("beforeunload", cleanup);
    return () => window.removeEventListener("beforeunload", cleanup);
  }, []);

  // Paneles / Modales y refs de botones (para anclar)
  const [reportOpen, setReportOpen] = useState(false);
  const [reportAnchorRect, setReportAnchorRect] = useState(null);
  const reportBtnRef = useRef(null); // botón superior "Reporte"

  const [infoOpen, setInfoOpen] = useState(false);
  const [infoAnchorRect, setInfoAnchorRect] = useState(null);
  const infoBtnRef = useRef(null); // FAB inferior "Info"

  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportModalAnchorRect, setReportModalAnchorRect] = useState(null);
  const reportFabRef = useRef(null); // FAB inferior "Reporte ciudadano"

  // Helper fetch JSON
  const fetchJson = useCallback(async (url, options = {}) => {
    const res = await fetch(url, { credentials: "include", ...options });
    const ct = res.headers.get("content-type") || "";
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}: ${text.slice(0, 200)}`);
    if (!ct.includes("application/json")) throw new Error(`No-JSON: ${text.slice(0, 200)}`);
    try { return JSON.parse(text); } catch { return {}; }
  }, []);

  // Cargar estados de zonas
  const handleRefreshZoneStates = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await fetchJson(`${window.BACKEND_URL}/api/admin/zones/states`);
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
  }, [fetchJson]);

  const handleZoneStateChange = (zoneName, newStateEn) => {
    setZoneStates((prev) => ({ ...prev, [zoneName]: newStateEn }));
  };
  const handleBulkZoneStatesUpdate = (updatesMap) => {
    if (!updatesMap || typeof updatesMap !== "object") return;
    setZoneStates((prev) => ({ ...prev, ...updatesMap }));
  };
  const handleZonesLoad = (loadedZones) => { if (Array.isArray(loadedZones)) setZones(loadedZones); };

  // Alertas visibles
  const loadAlerts = useCallback(async () => {
    try {
      const json = await fetchJson(`${window.BACKEND_URL}/api/reportes/visibles`);
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
    } catch {}
  }, [fetchJson]);

  useEffect(() => {
    loadAlerts();
    const t = setInterval(loadAlerts, 30000);
    return () => clearInterval(t);
  }, [loadAlerts]);

  // --------- Anclaje: recalcular posición al abrir, resize o scroll ----------
  const recalcAnchors = useCallback(() => {
    if (infoOpen && infoBtnRef.current) {
      setInfoAnchorRect(infoBtnRef.current.getBoundingClientRect());
    }
    if (reportOpen && reportBtnRef.current) {
      setReportAnchorRect(reportBtnRef.current.getBoundingClientRect());
    }
    if (reportModalOpen && reportFabRef.current) {
      setReportModalAnchorRect(reportFabRef.current.getBoundingClientRect());
    }
  }, [infoOpen, reportOpen, reportModalOpen]);

  useEffect(() => {
    const onResize = () => recalcAnchors();
    const onScroll = () => recalcAnchors();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [recalcAnchors]);

  // UI handlers (siempre setear anchorRect ANTES de abrir)
  const toggleReportPanel = () => {
    if (reportBtnRef.current) setReportAnchorRect(reportBtnRef.current.getBoundingClientRect());
    setReportOpen((v) => !v);
  };
  const closeReportPanel = () => setReportOpen(false);

  const toggleInfo = () => {
    if (infoBtnRef.current) setInfoAnchorRect(infoBtnRef.current.getBoundingClientRect());
    setInfoOpen((v) => !v);
  };
  const closeInfoPanel = () => setInfoOpen(false);

  const handleToggleReportModal = () => {
    if (reportFabRef.current) setReportModalAnchorRect(reportFabRef.current.getBoundingClientRect());
    setReportModalOpen((prev) => !prev);
  };
  const closeReportModal = () => setReportModalOpen(false);

  return (
    <main id="main" role="main" tabIndex={-1} className="relative w-full h-screen" style={{ minHeight: "100vh" }}>
      <h1 className="sr-only">Caminos que conectan – Gobierno de Cerro Largo</h1>

      {/* Barra superior */}
      <div className="absolute top-4 right-4 z-[1000] flex gap-2">
        <button
          onClick={handleRefreshZoneStates}
          className="bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-green-700 disabled:opacity-50"
          disabled={refreshing}
          title="Actualizar Mapa"
        >
          {refreshing ? "Actualizando..." : "Actualizar Mapa"}
        </button>

        {/* Botón que abre ReportHubPanel (panel de gestión/reportes) */}
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
        alerts={alerts}
      />

      {/* FABs inferior-izquierda */}
      <div
        className="fixed z-[1000] flex flex-col items-start gap-2"
        style={{ bottom: "max(1rem, env(safe-area-inset-bottom, 1rem))", left: "max(1rem, env(safe-area-inset-left, 1rem))" }}
      >
        {/* Botón que abre InfoPanel (panel de info) */}
        <InfoButton ref={infoBtnRef} onClick={toggleInfo} isOpen={infoOpen} />

        {/* FAB que abre ReportModal (reporte ciudadano) */}
        <ReportButton ref={reportFabRef} onClick={handleToggleReportModal} />
      </div>

      {/* Paneles y modales anclados a SUS botones */}
      <ReportHubPanel
        open={reportOpen}
        anchorRect={reportAnchorRect}
        onClose={closeReportPanel}
        buttonRef={reportBtnRef}   // por si el componente lo usa
      />

      <InfoPanel
        open={infoOpen}
        anchorRect={infoAnchorRect}
        onClose={closeInfoPanel}
        buttonRef={infoBtnRef}
      />

      <ReportModal
        open={reportModalOpen}
        anchorRect={reportModalAnchorRect}
        onClose={closeReportModal}
        /** geolocalización en vivo */
        userLocation={userLocation}
        startLiveLocation={startLiveLocation}
        geoError={geoError}
      />

      <SiteBanner />
    </main>
  );
}

// ---------------------------- App con Router ----------------------------
export default function App() {
  useBackendUrl(); // publica BACKEND_URL en window

  // Registrar SW
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      const onLoad = () => navigator.serviceWorker.register("/sw.js").catch(() => {});
      window.addEventListener("load", onLoad);
      return () => window.removeEventListener("load", onLoad);
    }
  }, []);

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
