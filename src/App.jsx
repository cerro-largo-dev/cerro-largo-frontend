// src/App-optimized.jsx — Versión optimizada con llamadas API paralelas
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

// Componente de loading optimizado
const OptimizedSuspense = ({ children, fallback = null }) => (
  <Suspense fallback={fallback}>{children}</Suspense>
);

// ---------------------------------------------------------------------------
// Util: BACKEND_URL optimizado
// ---------------------------------------------------------------------------
function useBackendUrl() {
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
    
    const url = String(be).replace(/\/$/, "");
    if (typeof window !== "undefined") window.BACKEND_URL = url;
    return url;
  }, []);
}

// ---------------------------------------------------------------------------
// Hook optimizado para llamadas API paralelas
// ---------------------------------------------------------------------------
function useParallelApiCalls(backendUrl) {
  const [data, setData] = useState({
    zoneStates: {},
    zones: [],
    alerts: [],
    banner: null,
    geoData: null
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchJson = useCallback(async (url, options = {}) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
    
    try {
      const res = await fetch(url, { 
        credentials: "include", 
        signal: controller.signal,
        ...options 
      });
      clearTimeout(timeoutId);
      
      const ct = res.headers.get("content-type") || "";
      const text = await res.text();
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}: ${text.slice(0, 200)}`);
      }
      
      if (!ct.includes("application/json")) {
        throw new Error(`No-JSON: ${text.slice(0, 200)}`);
      }
      
      return JSON.parse(text);
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw err;
    }
  }, []);

  const loadAllData = useCallback(async () => {
    if (!backendUrl) return;
    
    setLoading(true);
    setError(null);

    try {
      // Llamadas API paralelas para reducir latencia total
      const [
        zoneStatesResponse,
        alertsResponse,
        bannerResponse,
        geoDataResponse
      ] = await Promise.allSettled([
        fetchJson(`${backendUrl}/api/zones/states`),
        fetchJson(`${backendUrl}/api/reportes/visibles`),
        fetchJson(`${backendUrl}/api/banner`),
        fetch('/assets/combined_zones.geojson').then(r => r.json())
      ]);

      const newData = { ...data };

      // Procesar zone states
      if (zoneStatesResponse.status === 'fulfilled' && zoneStatesResponse.value?.success) {
        const mapping = {};
        Object.entries(zoneStatesResponse.value.states || {}).forEach(([name, info]) => {
          mapping[name] = info?.state || "red";
        });
        newData.zoneStates = mapping;
      }

      // Procesar alerts
      if (alertsResponse.status === 'fulfilled' && alertsResponse.value?.ok) {
        newData.alerts = (alertsResponse.value.reportes || [])
          .filter((a) => a.latitud != null && a.longitud != null)
          .map((a) => ({
            id: a.id,
            lat: a.latitud,
            lng: a.longitud,
            titulo: a.nombre_lugar || "Reporte",
            descripcion: a.descripcion || "",
          }));
      }

      // Procesar banner
      if (bannerResponse.status === 'fulfilled') {
        newData.banner = bannerResponse.value;
      }

      // Procesar geo data
      if (geoDataResponse.status === 'fulfilled') {
        newData.geoData = geoDataResponse.value;
        // Extraer zones del GeoJSON
        if (geoDataResponse.value?.features) {
          newData.zones = geoDataResponse.value.features.map(f => ({
            name: f.properties?.name || f.properties?.NAME || 'Unknown',
            ...f.properties
          }));
        }
      }

      setData(newData);
    } catch (err) {
      console.warn("Error loading data:", err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [backendUrl, fetchJson]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  return { data, loading, error, refetch: loadAllData };
}

// ---------------------------------------------------------------------------
// Home Page optimizada
// ---------------------------------------------------------------------------
function HomePage() {
  const backendUrl = useBackendUrl();
  const { data, loading, error, refetch } = useParallelApiCalls(backendUrl);
  
  // Estado local simplificado
  const [userLocation, setUserLocation] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const geoWatchIdRef = useRef(null);
  const [geoError, setGeoError] = useState("");

  // Paneles y modales
  const [reportOpen, setReportOpen] = useState(false);
  const [reportAnchorRect, setReportAnchorRect] = useState(null);
  const reportBtnRef = useRef(null);

  const [infoOpen, setInfoOpen] = useState(false);
  const [infoAnchorRect, setInfoAnchorRect] = useState(null);
  const infoBtnRef = useRef(null);

  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportModalAnchorRect, setReportModalAnchorRect] = useState(null);
  const reportFabRef = useRef(null);

  // Geolocalización optimizada
  const startLiveLocation = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setGeoError("La geolocalización no está soportada en este navegador");
      setUserLocation({ lat: -32.3667, lng: -54.1667 });
      return;
    }
    if (geoWatchIdRef.current != null) return;

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setGeoError("");
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        setGeoError("No se pudo obtener GPS; usando ubicación aproximada de Cerro Largo.");
        setUserLocation({ lat: -32.3667, lng: -54.1667 });
      },
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 } // Menos agresivo
    );
    geoWatchIdRef.current = id;
  }, []);

  // Limpieza de geolocalización
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

  // Handlers optimizados
  const handleRefreshZoneStates = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const handleZoneStateChange = useCallback((zoneName, newStateEn) => {
    // Optimistic update
    setData(prev => ({
      ...prev,
      zoneStates: { ...prev.zoneStates, [zoneName]: newStateEn }
    }));
  }, []);

  // Polling de alertas optimizado (menos frecuente)
  useEffect(() => {
    if (loading || error) return;
    
    const interval = setInterval(() => {
      // Solo recargar alertas, no todo
      fetch(`${backendUrl}/api/reportes/visibles`)
        .then(r => r.json())
        .then(json => {
          if (json?.ok && Array.isArray(json.reportes)) {
            const alerts = json.reportes
              .filter((a) => a.latitud != null && a.longitud != null)
              .map((a) => ({
                id: a.id,
                lat: a.latitud,
                lng: a.longitud,
                titulo: a.nombre_lugar || "Reporte",
                descripcion: a.descripcion || "",
              }));
            setData(prev => ({ ...prev, alerts }));
          }
        })
        .catch(() => {}); // Silent fail
    }, 180000); // 3 minutos

    return () => clearInterval(interval);
  }, [backendUrl, loading, error]);

  // Loading state mejorado
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto mb-4"></div>
          <p className="text-slate-600">Cargando datos del sistema...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Error de conexión</h2>
          <p className="text-slate-600 mb-4">{error}</p>
          <button 
            onClick={refetch}
            className="btn-primary"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-root">
      {/* Banner con Suspense */}
      <OptimizedSuspense>
        <SiteBanner />
      </OptimizedSuspense>

      {/* Mapa principal con prioridad */}
      <OptimizedSuspense 
        fallback={
          <div className="map-skeleton" aria-label="Cargando mapa...">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-slate-600">Inicializando mapa...</div>
            </div>
          </div>
        }
      >
        <MapComponent
          userLocation={userLocation}
          onUserLocationRequest={startLiveLocation}
          zoneStates={data.zoneStates}
          onZoneStatesLoad={handleZoneStateChange}
          zones={data.zones}
          onZonesLoad={() => {}} // Ya cargado
          alerts={data.alerts}
          geoData={data.geoData}
        />
      </OptimizedSuspense>

      {/* Botones y paneles con lazy loading */}
      <OptimizedSuspense>
        <ReportButton
          ref={reportBtnRef}
          onClick={() => {
            const rect = reportBtnRef.current?.getBoundingClientRect();
            setReportAnchorRect(rect || null);
            setReportOpen(true);
          }}
        />
      </OptimizedSuspense>

      <OptimizedSuspense>
        <InfoButton
          ref={infoBtnRef}
          onClick={() => {
            const rect = infoBtnRef.current?.getBoundingClientRect();
            setInfoAnchorRect(rect || null);
            setInfoOpen(true);
          }}
        />
      </OptimizedSuspense>

      {/* Paneles condicionales */}
      {reportOpen && (
        <OptimizedSuspense>
          <ReportHubPanel
            isOpen={reportOpen}
            onClose={() => setReportOpen(false)}
            anchorRect={reportAnchorRect}
            onRefreshZoneStates={handleRefreshZoneStates}
            refreshing={refreshing}
            zoneStates={data.zoneStates}
            onZoneStateChange={handleZoneStateChange}
            zones={data.zones}
          />
        </OptimizedSuspense>
      )}

      {infoOpen && (
        <OptimizedSuspense>
          <InfoPanel
            isOpen={infoOpen}
            onClose={() => setInfoOpen(false)}
            anchorRect={infoAnchorRect}
          />
        </OptimizedSuspense>
      )}

      {reportModalOpen && (
        <OptimizedSuspense>
          <ReportModal
            isOpen={reportModalOpen}
            onClose={() => setReportModalOpen(false)}
            anchorRect={reportModalAnchorRect}
            userLocation={userLocation}
          />
        </OptimizedSuspense>
      )}

      {geoError && (
        <div className="fixed bottom-4 left-4 bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded max-w-sm">
          <p className="text-sm">{geoError}</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// App principal con rutas optimizadas
// ---------------------------------------------------------------------------
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route 
          path="/admin" 
          element={
            <OptimizedSuspense fallback={<div>Cargando panel administrativo...</div>}>
              <AdminPanel />
            </OptimizedSuspense>
          } 
        />
        <Route 
          path="/reports" 
          element={
            <OptimizedSuspense fallback={<div>Cargando panel de reportes...</div>}>
              <ReportsPanel />
            </OptimizedSuspense>
          } 
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

