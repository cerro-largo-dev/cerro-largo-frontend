// src/components/MapComponent.jsx
import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  useMap,
  Popup,
  Marker,
} from "react-leaflet";
import L from "leaflet";

import combinedPolygonsUrl from "../assets/combined_polygons.geojson?url";
// La caminería y los reportes se gestionan según zoom

import {
  ROAD_VIS_THRESHOLD,
  getRoadStyle,
  onEachRoadFeature,
} from "../utils/caminosUtils";

// ----------------- Iconos Leaflet por defecto -----------------
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

// Ícono GPS
const gpsIcon = new L.Icon({
  iconUrl:
    "data:image/svg+xml;base64," +
    btoa(
      `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" fill="#3b82f6"/>
        <circle cx="12" cy="12" r="4" fill="#fff"/>
      </svg>
    `.trim()
    ),
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -12],
});

// Ícono de atención (alertas)
const ICON_SIZE = 28;
const attentionIcon = L.divIcon({
  className: "attention-pin",
  html: `
    <svg xmlns="http://www.w3.org/2000/svg" width="${ICON_SIZE}" height="${ICON_SIZE}" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3 L21 20 H3 Z" fill="#FDE68A" stroke="#F59E0B" stroke-opacity="0.5" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" />
      <rect x="11" y="8" width="2" height="7" rx="1" fill="#7C2D12" fill-opacity="0.85" />
      <circle cx="12" cy="17" r="1.2" fill="#7C2D12" fill-opacity="0.85" />
    </svg>
  `,
  iconSize: [ICON_SIZE, ICON_SIZE],
  iconAnchor: [ICON_SIZE / 2, ICON_SIZE - 2],
  popupAnchor: [0, -(ICON_SIZE - 8)],
});

// ----------------- Utils locales -----------------
const stateColors = { green: "#22c55e", yellow: "#eab308", red: "#ef4444" };
const LOADING_FILL = "#e5e7eb";
const LOADING_STROKE = "#9ca3af";

const norm = (s = "") =>
  String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[\s\\-_().,/]+/g, "");

// Control de zoom (para disparar cargas diferidas)
function ZoomWatcher({ onZoom }) {
  const map = useMap();
  useEffect(() => {
    const h = () => onZoom(map.getZoom());
    map.on("zoomend", h);
    onZoom(map.getZoom());
    return () => map.off("zoomend", h);
  }, [map, onZoom]);
  return null;
}

// ============================================================================
// Componente
// ============================================================================
/**
 * Props opcionales:
 *  - zoneStates (si viene de arriba, se usa y se prioriza)
 *  - onZonesLoad, onZoneStatesLoad
 *  - userLocation
 */
export default function MapComponent({
  zoneStates,
  onZonesLoad,
  onZoneStatesLoad,
  userLocation,
}) {
  const mapRef = useRef(null);
  const [currentZoom, setCurrentZoom] = useState(9);

  const [combinedGeo, setCombinedGeo] = useState(null);

  // Caminería lazy
  const [roadsUrl, setRoadsUrl] = useState(null);
  const [caminosData, setCaminosData] = useState(null);

  // Alertas (reportes visibles) solo con zoom
  const [alerts, setAlerts] = useState([]);
  const alertsTimerRef = useRef(null);
  const ALERTS_POLL_MS = 120000;

  // ZoneState interno (si no lo pasan por props)
  const [fetchedStates, setFetchedStates] = useState({});
  const statesTimerRef = useRef(null);
  const STATES_POLL_MS = 300000; // 5 min

  // Normalizar estados combinando prop y fetch (prop tiene prioridad)
  const normalizedStates = useMemo(() => {
    const out = {};
    // 1) estados obtenidos por fetch
    for (const [k, v] of Object.entries(fetchedStates || {})) {
      out[norm(k)] = String(v).toLowerCase();
    }
    // 2) si hay props, pisan a lo anterior
    if (zoneStates) {
      const base =
        zoneStates.states && typeof zoneStates.states === "object"
          ? zoneStates.states
          : zoneStates;
      for (const [k, v] of Object.entries(base)) {
        const val = typeof v === "string" ? v : v?.state;
        if (!val) continue;
        out[norm(k)] = String(val).toLowerCase();
      }
    }
    return out;
  }, [zoneStates, fetchedStates]);

  // BACKEND_URL coherente con App
  const BACKEND_URL = useMemo(() => {
    const fromWin =
      typeof window !== "undefined" && window.BACKEND_URL
        ? String(window.BACKEND_URL)
        : "";
    const envs =
      (typeof import.meta !== "undefined" &&
        import.meta.env &&
        (import.meta.env.VITE_REACT_APP_BACKEND_URL ||
          import.meta.env.VITE_BACKEND_URL)) ||
      (typeof process !== "undefined" &&
        process.env &&
        (process.env.REACT_APP_BACKEND_URL || process.env.VITE_BACKEND_URL)) ||
      "";
    return (fromWin || envs || "https://cerro-largo-backend.onrender.com").replace(
      /\/$/,
      ""
    );
  }, []);

  const mapCenter = useMemo(() => [-32.35, -54.2], []);
  const handleZoomChange = (z) => setCurrentZoom(z);

  // Helper fetch JSON
  const fetchJson = useCallback(async (url, options = {}) => {
    const res = await fetch(url, { credentials: "include", ...options });
    const ct = res.headers.get("content-type") || "";
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 160)}`);
    if (!ct.includes("application/json")) throw new Error(`No-JSON: ${text.slice(0, 160)}`);
    try {
      return JSON.parse(text);
    } catch {
      return {};
    }
  }, []);

  // -------- Cargar polígonos (siempre) --------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(combinedPolygonsUrl, { cache: "no-store" });
        if (!res.ok) throw new Error("GeoJSON polígonos no disponible");
        const json = await res.json();
        if (cancelled) return;
        setCombinedGeo(json);

        // Derivar lista de zonas
        const allZones = [];
        (json.features || []).forEach((f) => {
          const p = f.properties || {};
          if (p.municipio) allZones.push(p.municipio);
          else if (p.serie) allZones.push(`Melo (${p.serie})`);
        });
        onZonesLoad && onZonesLoad(allZones);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("Error cargando polígonos:", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [onZonesLoad]);

  // -------- Cargar ZoneState del backend (al montar + cada 5 min) --------
  useEffect(() => {
    let stopped = false;

    const parseStatePayload = (data) => {
      // Acepta {states:{...}} o {...} plano
      const src =
        data && typeof data === "object" && data.states && typeof data.states === "object"
          ? data.states
          : data && typeof data === "object"
          ? data
          : {};
      const map = {};
      for (const [name, info] of Object.entries(src)) {
        const val = typeof info === "string" ? info : info?.state;
        if (val) map[name] = String(val).toLowerCase();
      }
      return map;
    };

    const loadOnce = async () => {
      try {
        const json = await fetchJson(`${BACKEND_URL}/api/admin/zones/states`, {
          cache: "no-store",
        });
        if (stopped) return;
        const map = parseStatePayload(json);
        if (Object.keys(map).length) {
          setFetchedStates(map);
          onZoneStatesLoad && onZoneStatesLoad(map);
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("ZoneState no se pudo cargar:", e.message);
      }
    };

    loadOnce();
    statesTimerRef.current = setInterval(loadOnce, STATES_POLL_MS);

    return () => {
      stopped = true;
      if (statesTimerRef.current) {
        clearInterval(statesTimerRef.current);
        statesTimerRef.current = null;
      }
    };
  }, [BACKEND_URL, fetchJson, onZoneStatesLoad]);

  // -------- LAZY-LOAD de caminería (sólo cuando zoom >= umbral) --------
  useEffect(() => {
    let cancelled = false;
    const maybeLoadRoads = async () => {
      if (currentZoom < ROAD_VIS_THRESHOLD) return;
      try {
        let url = roadsUrl;
        if (!url) {
          const mod = await import(
            /* @vite-ignore */ "../assets/camineria_cerro_largo.json?url"
          );
          url = mod?.default;
          if (!url) throw new Error("URL caminería no resuelta");
          if (!cancelled) setRoadsUrl(url);
        }
        if (!caminosData && url) {
          const res = await fetch(url, { cache: "force-cache" });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const json = await res.json();
          if (!cancelled) setCaminosData(json);
        }
      } catch (e) {
        console.error("Lazy caminería:", e);
      }
    };
    maybeLoadRoads();
    return () => {
      cancelled = true;
    };
  }, [currentZoom, roadsUrl, caminosData]);

  // -------- Reportes visibles (sólo con zoom; polling mientras estés cerca) --------
  useEffect(() => {
    if (alertsTimerRef.current) {
      clearInterval(alertsTimerRef.current);
      alertsTimerRef.current = null;
    }
    if (currentZoom < ROAD_VIS_THRESHOLD) {
      setAlerts([]);
      return;
    }

    let stopped = false;
    const loadAlerts = async () => {
      try {
        const json = await fetchJson(
          `${BACKEND_URL}/api/reportes/visibles`,
          { cache: "no-store" }
        );
        if (stopped) return;

        const arr = json?.reportes || (Array.isArray(json) ? json : []);
        setAlerts(
          (arr || [])
            .filter((a) => a.latitud != null && a.longitud != null)
            .map((a, i) => ({
              id: a.id ?? i,
              lat: a.latitud,
              lng: a.longitud,
              titulo: a.nombre_lugar || "Reporte",
              descripcion: a.descripcion || "",
            }))
        );
      } catch {
        // silencioso
      }
    };

    loadAlerts();
    alertsTimerRef.current = setInterval(loadAlerts, ALERTS_POLL_MS);

    return () => {
      stopped = true;
      if (alertsTimerRef.current) {
        clearInterval(alertsTimerRef.current);
        alertsTimerRef.current = null;
      }
    };
  }, [currentZoom, BACKEND_URL, fetchJson]);

  // -------- Estilos/Popups de polígonos según estados normalizados --------
  const polygonStyle = (feature) => {
    const p = feature?.properties || {};
    const zoneName = p.municipio
      ? p.municipio
      : p.serie
      ? `Melo (${p.serie})`
      : "";

    if (!zoneName || !Object.keys(normalizedStates).length) {
      return {
        fillColor: LOADING_FILL,
        color: LOADING_STROKE,
        weight: 1.2,
        opacity: 0.8,
        fillOpacity: 0.25,
      };
    }
    const st = normalizedStates[norm(zoneName)];
    const color = stateColors[st] || stateColors.green;
    return {
      fillColor: color,
      color,
      weight: 2,
      opacity: 0.9,
      fillOpacity: 0.6,
    };
  };

  const stateLabel = (s) =>
    s === "green" ? "Habilitado" : s === "yellow" ? "Precaución" : s === "red" ? "Cerrado" : "Desconocido";

  const polygonOnEach = (feature, layer) => {
    const p = feature?.properties || {};
    const zoneName = p.municipio
      ? p.municipio
      : p.serie
      ? `Melo (${p.serie})`
      : "Zona";
    const st = normalizedStates[norm(zoneName)];
    const area = p.area_km2 != null ? Number(p.area_km2).toFixed(2) : "N/A";

    layer.bindPopup(
      `<b>${zoneName}</b><br/>` +
        `Departamento: ${p.depto || "Cerro Largo"}<br/>` +
        `Área: ${area} km²<br/>` +
        `Estado: ${stateLabel(st)}`
    );
    layer.on({
      mouseover: (e) => e.target.setStyle({ fillOpacity: 0.9 }),
      mouseout: (e) => e.target.setStyle({ fillOpacity: 0.6 }),
    });
  };

  const showRoads =
    currentZoom >= ROAD_VIS_THRESHOLD &&
    caminosData &&
    (caminosData.features?.length || 0) > 0;

  const showAlerts = currentZoom >= ROAD_VIS_THRESHOLD && alerts.length > 0;

  return (
    <div className="map-wrap">
      <MapContainer
        center={mapCenter}
        zoom={9}
        scrollWheelZoom
        style={{ width: "100%", height: "100%" }}
        whenCreated={(m) => (mapRef.current = m)}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Polígonos (municipios + series) con estados */}
        {combinedGeo && (combinedGeo.features?.length || 0) > 0 && (
          <GeoJSON
            data={combinedGeo}
            style={polygonStyle}
            onEachFeature={polygonOnEach}
          />
        )}

        {/* Caminería (lazy por zoom) */}
        {showRoads && (
          <GeoJSON
            key={`roads-zoom-${currentZoom}`}
            data={caminosData}
            style={(f) => getRoadStyle(f, currentZoom)}
            onEachFeature={onEachRoadFeature}
            pathOptions={{ interactive: true, bubblingMouseEvents: false }}
          />
        )}

        {/* Ubicación usuario */}
        {userLocation &&
          userLocation.lat != null &&
          userLocation.lng != null && (
            <Marker position={[userLocation.lat, userLocation.lng]} icon={gpsIcon}>
              <Popup>
                <div style={{ textAlign: "center" }}>
                  <strong>Tu ubicación</strong>
                  <br />
                  <small>
                    Lat: {Number(userLocation.lat).toFixed(6)} <br />
                    Lng: {Number(userLocation.lng).toFixed(6)}
                  </small>
                </div>
              </Popup>
            </Marker>
          )}

        {/* Alertas visibles (solo cerca) */}
        {showAlerts &&
          alerts.map((a) => (
            <Marker
              key={a.id || `${a.lat}-${a.lng}`}
              position={[a.lat, a.lng]}
              icon={attentionIcon}
            >
              <Popup>
                <div style={{ fontSize: 13 }}>
                  <strong>{a.titulo || "Atención"}</strong>
                  <br />
                  <small>{a.descripcion || ""}</small>
                </div>
              </Popup>
            </Marker>
          ))}

        <ZoomWatcher onZoom={setCurrentZoom} />
      </MapContainer>
    </div>
  );
}
