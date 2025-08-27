// src/App.jsx — lazy routes para AdminPanel y ReportsPanel
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  lazy,
  Suspense,
} from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./App.css";

// Lazy loading más granular
const MapComponent = lazy(() => import("./components/MapComponent"));
const ReportButton = lazy(() => import("./components/Reportes/ReportButton"));
const ReportModal = lazy(() => import("./components/Reportes/ReportModal"));
const ReportHubPanel = lazy(() => import("./components/ReportHubPanel"));
const InfoButton = lazy(() => import("./components/InfoButton"));
const InfoPanel = lazy(() => import("./components/InfoPanel"));
const SiteBanner = lazy(() => import("./components/SiteBanner"));
const AdminPanel = lazy(() => import("./components/AdminPanel"));
const ReportsPanel = lazy(() => import("./components/ReportsPanel"));

// import AlertWidget from "./components/AlertWidget";

// ❗ Lazy-loaded routes
const AdminPanel = lazy(() => import("./components/AdminPanel"));
const ReportsPanel = lazy(() => import("./components/ReportsPanel"));

// ---------------------------------------------------------------------------
// Util: BACKEND_URL
// ---------------------------------------------------------------------------
function useBackendUrl() {
  useEffect(() => {
    const be =
      (typeof import.meta !== "undefined" &&
        import.meta.env &&
        (import.meta.env.VITE_REACT_APP_BACKEND_URL ||
          import.meta.env.VITE_BACKEND_URL)) ||
      (typeof process !== "undefined" &&
        process.env &&
        (process.env.REACT_APP_BACKEND_URL || process.env.VITE_BACKEND_URL)) ||
      "https://cerro-largo-backend.onrender.com";
    if (typeof window !== "undefined")
      window.BACKEND_URL = String(be).replace(/\/$/, "");
  }, []);

  return useMemo(() => {
    const be =
      (typeof window !== "undefined" && window.BACKEND_URL) ||
      (typeof import.meta !== "undefined" &&
        import.meta.env &&
        (import.meta.env.VITE_REACT_APP_BACKEND_URL ||
          import.meta.env.VITE_BACKEND_URL)) ||
      (typeof process !== "undefined" &&
        process.env &&
        (process.env.REACT_APP_BACKEND_URL || process.env.VITE_BACKEND_URL)) ||
      "https://cerro-largo-backend.onrender.com";
    return String(be).replace(/\/$/, "");
  }, []);
}

// ---------------------------------------------------------------------------
// Home Page (Mapa)
// ---------------------------------------------------------------------------
function HomePage() {
  useBackendUrl(); // publica BACKEND_URL en window

  // Estado global
  const [zoneStates, setZoneStates] = useState({});
  const [zones, setZones] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // ALERTAS (visibles) — se activan recién cuando mapa+states están listos
  const [alerts, setAlerts] = useState([]);
  const [statesReady, setStatesReady] = useState(false);
  const [mapSettled, setMapSettled] = useState(false);

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
        setGeoError(
          "No se pudo obtener GPS; usando ubicación aproximada de Cerro Largo."
        );
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
        try {
          navigator.geolocation.clearWatch(geoWatchIdRef.current);
        } catch {}
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
    if (!res.ok)
      throw new Error(
        `HTTP ${res.status} ${res.statusText}: ${text.slice(0, 200)}`
      );
    if (!ct.includes("application/json"))
      throw new Error(`No-JSON: ${text.slice(0, 200)}`);
    try {
      return JSON.parse(text);
    } catch {
      return {};
    }
  }, []);

  // Cargar estados de zonas (PRIORIDAD)
  const handleRefreshZoneStates = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await fetchJson(
        `${window.BACKEND_URL}/api/admin/zones/states`
      );
      if (data?.success && data.states) {
        const mapping = {};
        Object.entries(data.states).forEach(([name, info]) => {
          mapping[name] = info?.state || "red";
        });
        setZoneStates(mapping);
        // marcar states listos si hay contenido
        if (Object.keys(mapping).length > 0) setStatesReady(true);
      }
    } catch (e) {
      console.warn("No se pudo refrescar estados:", e.message);
    } finally {
      setRefreshing(false);
    }
  }, [fetchJson]);

  // Si estados vinieron por MapComponent (onZoneStatesLoad), también marcar ready
  useEffect(() => {
    if (zoneStates && Object.keys(zoneStates).length > 0) setStatesReady(true);
  }, [zoneStates]);

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

  // ALERTAS visibles (SVG atención) — retrasadas y menos frecuentes
  const ALERTS_POLL_MS = 120000; // 2 minutos
  const alertsIntervalRef = useRef(null);

  const loadAlerts = useCallback(async () => {
    try {
      const json = await fetchJson(
        `${window.BACKEND_URL}/api/reportes/visibles`
      );
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
    } catch {
      // silencio: no bloquear la UI ni saturar logs
    }
  }, [fetchJson]);

  // Esperar a que el mapa “asiente”
  useEffect(() => {
    const markSettledSoon = () => setMapSettled(true);
    if (document.readyState === "complete") {
      if ("requestIdleCallback" in window) {
        // @ts-ignore
        window.requestIdleCallback(markSettledSoon, { timeout: 1500 });
      } else {
        setTimeout(markSettledSoon, 1500);
      }
    } else {
      const onLoad = () => {
        if ("requestIdleCallback" in window) {
          // @ts-ignore
          window.requestIdleCallback(markSettledSoon, { timeout: 1500 });
        } else {
          setTimeout(markSettledSoon, 1500);
        }
      };
      window.addEventListener("load", onLoad, { once: true });
      return () => window.removeEventListener("load", onLoad);
    }
  }, []);

  // Iniciar/pausar polling de alertas SOLO cuando states+map estén listos
  useEffect(() => {
    if (alertsIntervalRef.current) {
      clearInterval(alertsIntervalRef.current);
      alertsIntervalRef.current = null;
    }
    if (!(statesReady && mapSettled)) return;

    let stopped = false;

    const start = async () => {
      await loadAlerts();
      if (stopped) return;
      alertsIntervalRef.current = setInterval(loadAlerts, ALERTS_POLL_MS);
    };

    const onVis = async () => {
      if (document.visibilityState === "hidden") {
        if (alertsIntervalRef.current) {
          clearInterval(alertsIntervalRef.current);
          alertsIntervalRef.current = null;
        }
      } else {
        await loadAlerts();
        if (!alertsIntervalRef.current) {
          alertsIntervalRef.current = setInterval(loadAlerts, ALERTS_POLL_MS);
        }
      }
    };

    start();
    document.addEventListener("visibilitychange", onVis);

    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVis);
      if (alertsIntervalRef.current) {
        clearInterval(alertsIntervalRef.current);
        alertsIntervalRef.current = null;
      }
    };
  }, [statesReady, mapSettled, loadAlerts]);

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
    if (reportBtnRef.current)
      setReportAnchorRect(reportBtnRef.current.getBoundingClientRect());
    setReportOpen((v) => !v);
  };
  const closeReportPanel = () => setReportOpen(false);

  const toggleInfo = () => {
    if (infoBtnRef.current)
      setInfoAnchorRect(infoBtnRef.current.getBoundingClientRect());
    setInfoOpen((v) => !v);
  };
  const closeInfoPanel = () => setInfoOpen(false);

  const handleToggleReportModal = () => {
    if (reportFabRef.current)
      setReportModalAnchorRect(reportFabRef.current.getBoundingClientRect());
    setReportModalOpen((prev) => !prev);
  };
  const closeReportModal = () => setReportModalOpen(false);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <main
      id="main"
      role="main"
      tabIndex={-1}
      className="relative w-full h-screen"
      style={{ minHeight: "100vh" }}
    >
      <h1 className="sr-only">
        Caminos que conectan – Gobierno de Cerro Largo
      </h1>

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
        onZoneStatesLoad={(initialStates) =>
          initialStates && setZoneStates(initialStates)
        }
        onZoneStateChange={handleZoneStateChange}
        onZonesLoad={handleZonesLoad}
        userLocation={userLocation}
        alerts={alerts}
      />

      {/* FABs inferior-izquierda */}
      <div
        className="fixed z-[1000] flex flex-col items-start gap-2"
        style={{
          bottom: "max(1rem, env(safe-area-inset-bottom, 1rem))",
          left: "max(1rem, env(safe-area-inset-left, 1rem))",
        }}
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
        buttonRef={reportBtnRef}
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

// ---------------------------------------------------------------------------
// App con Router (lazy routes)
// ---------------------------------------------------------------------------
export default function App() {
  useBackendUrl(); // publica BACKEND_URL en window

  // Registrar SW
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      const onLoad = () =>
        navigator.serviceWorker.register("/sw.js").catch(() => {});
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
            <Suspense fallback={null}>
              <AdminPanel
                onRefreshZoneStates={() => {}}
                onBulkZoneStatesUpdate={() => {}}
                onZoneStateChange={() => {}}
              />
            </Suspense>
          }
        />
        <Route
          path="/admin/reportes"
          element={
            <Suspense fallback={null}>
              <ReportsPanel />
            </Suspense>
          }
        />
        <Route path="*" element={<HomePage />} />
      </Routes>
    </BrowserRouter>
  );
}
