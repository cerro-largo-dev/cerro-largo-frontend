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
// La caminería se importa LAZY cuando el zoom supera el umbral

import {
  ROAD_VIS_THRESHOLD,
  getRoadStyle,
  onEachRoadFeature,
} from "../utils/caminosUtils";

// ----------------- Iconos Leaflet por defecto -----------------
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// Ícono GPS
const gpsIcon = new L.Icon({
  iconUrl:
    "data:image/svg+xml;base64," +
    btoa(
      `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#3b82f6">
        <circle cx="12" cy="12" r="8" fill="#3b82f6" stroke="#ffffff" stroke-width="2"/>
        <circle cx="12" cy="12" r="4" fill="#ffffff"/>
      </svg>
    `.trim()
    ),
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -12],
});

// Ícono de atención para alertas
const ICON_SIZE = 28;
const attentionIcon = L.divIcon({
  className: "attention-pin",
  html: `
    <svg xmlns="http://www.w3.org/2000/svg" width="${ICON_SIZE}" height="${ICON_SIZE}" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3 L21 20 H3 Z" fill="#FDE68A" stroke="#F59E0B" stroke-opacity="0.5" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" />
      <rect x="11" y="8" width="2" height="7" rx="1" fill="#7C2D12" fill-opacity="0.8" />
      <circle cx="12" cy="16.5" r="1.2" fill="#7C2D12" fill-opacity="0.8" />
    </svg>
  `,
  iconSize: [ICON_SIZE, ICON_SIZE],
  iconAnchor: [ICON_SIZE / 2, ICON_SIZE - 2],
  popupAnchor: [0, -(ICON_SIZE - 8)],
});

// ----------------- Util estado/estilos -----------------
const stateColors = { green: "#22c55e", yellow: "#eab308", red: "#ef4444" };
const LOADING_FILL = "#e5e7eb";
const LOADING_STROKE = "#9ca3af";

const norm = (s = "") =>
  String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[\s\-_().,/]+/g, "");

// ----------------- Zoom handler -----------------
function ZoomHandler({ onZoomChange }) {
  const map = useMap();
  useEffect(() => {
    const handleZoom = () => onZoomChange(map.getZoom());
    map.on("zoomend", handleZoom);
    onZoomChange(map.getZoom());
    return () => map.off("zoomend", handleZoom);
  }, [map, onZoomChange]);
  return null;
}

// ============================================================================
// Componente
// ============================================================================
export default function MapComponent({
  zoneStates, // puede venir plano o {states:{...}}
  onZoneStatesLoad,
  onZoneStateChange,
  onZonesLoad,
  userLocation,
}) {
  const [combinedGeo, setCombinedGeo] = useState(null);

  // Caminería (carga diferida)
  const [roadsUrl, setRoadsUrl] = useState(null); // URL tras import dinámico
  const [caminosData, setCaminosData] = useState(null); // GeoJSON parseado

  const [zones, setZones] = useState([]);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [currentZoom, setCurrentZoom] = useState(9);
  const mapRef = useRef(null);

  // Alertas visibles — SOLO cuando zoom >= umbral
  const [alerts, setAlerts] = useState([]);
  const alertsTimerRef = useRef(null);
  const ALERTS_POLL_MS = 120000; // 2 min

  const statesLoadedProp = useMemo(
    () => zoneStates && Object.keys(zoneStates).length > 0,
    [zoneStates]
  );

  // Deriva un mapa normalizado: clave normalizada -> "green|yellow|red"
  const normalizedStates = useMemo(() => {
    const out = {};
    if (!zoneStates) return out;
    const base =
      zoneStates.states && typeof zoneStates.states === "object"
        ? zoneStates.states
        : zoneStates;
    for (const [k, v] of Object.entries(base)) {
      const stateVal = typeof v === "string" ? v : v?.state;
      if (!stateVal) continue;
      out[norm(k)] = String(stateVal).toLowerCase();
    }
    return out;
  }, [zoneStates]);

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

  const mapCenter = [-32.35, -54.2];
  const handleZoomChange = (z) => setCurrentZoom(z);

  // Helper: fetch JSON simple
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

  // Carga inicial: polígonos
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const combinedRes = await fetch(combinedPolygonsUrl, {
          cache: "no-store",
        });
        if (!combinedRes.ok)
          throw new Error("GeoJSON polígonos no disponible");

        const combinedJson = await combinedRes.json();
        if (cancelled) return;

        setCombinedGeo(combinedJson);

        // Listado de zonas
        const allZones = [];
        (combinedJson.features || []).forEach((f) => {
          const p = f.properties || {};
          if (p.municipio) allZones.push(p.municipio);
          else if (p.serie) allZones.push(`Melo (${p.serie})`);
        });
        setZones(allZones);
        onZonesLoad && onZonesLoad(allZones);
        onZoneStatesLoad && onZoneStatesLoad(normalizedStates);
      } catch (err) {
        if (!cancelled) {
          console.error("Error cargando datos del mapa:", err);
          setMessage({ type: "error", text: "Error al cargar datos del mapa" });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // LAZY-LOAD de caminería: importar URL y fetchear el JSON cuando el zoom supera el umbral
  useEffect(() => {
    let cancelled = false;

    const loadRoadsIfNeeded = async () => {
      if (currentZoom < ROAD_VIS_THRESHOLD) return; // aún no

      try {
        // 1) Import dinámico de la URL del asset (solo una vez)
        let url = roadsUrl;
        if (!url) {
          const mod = await import(
            /* @vite-ignore */ "../assets/camineria_cerro_largo.json?url"
          );
          url = mod?.default;
          if (!url) throw new Error("URL de caminería no resuelta");
          if (!cancelled) setRoadsUrl(url);
        }

        // 2) Fetch + parse del GeoJSON (si aún no lo tenemos)
        if (!caminosData && url) {
          const res = await fetch(url, { cache: "force-cache" });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const json = await res.json();
          if (!cancelled) setCaminosData(json);
        }
      } catch (e) {
        console.error("Lazy-load caminería:", e);
      }
    };

    loadRoadsIfNeeded();
    return () => {
      cancelled = true;
    };
  }, [currentZoom, roadsUrl, caminosData]);

  // ALERTAS VISIBLES: cargar/pollear SOLO cuando zoom >= umbral; detener y limpiar al alejar
  useEffect(() => {
    // limpiar timer previo
    if (alertsTimerRef.current) {
      clearInterval(alertsTimerRef.current);
      alertsTimerRef.current = null;
    }
    // si estás lejos, vaciamos y no cargamos
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
        } else {
          // esquema alternativo por compat
          const arr = Array.isArray(json) ? json : [];
          setAlerts(
            arr
              .filter((a) => a.latitud != null && a.longitud != null)
              .map((a, i) => ({
                id: a.id || i,
                lat: a.latitud,
                lng: a.longitud,
                titulo: a.nombre_lugar || "Reporte",
                descripcion: a.descripcion || "",
              }))
          );
        }
      } catch (e) {
        // silencioso: no bloquear UI
        // console.warn("No se pudieron cargar alertas:", e);
      }
    };

    // carga inicial inmediata
    loadAlerts();

    // comenzar polling mientras estes cerca
    alertsTimerRef.current = setInterval(loadAlerts, ALERTS_POLL_MS);

    return () => {
      stopped = true;
      if (alertsTimerRef.current) {
        clearInterval(alertsTimerRef.current);
        alertsTimerRef.current = null;
      }
    };
  }, [currentZoom, BACKEND_URL, fetchJson]);

  // Estilo por estado usando nombres normalizados
  const getFeatureStyle = (feature) => {
    const p = feature.properties || {};
    const zoneName = p.municipio
      ? p.municipio
      : p.serie
      ? `Melo (${p.serie})`
      : "";

    if (!Object.keys(normalizedStates).length && !statesLoadedProp) {
      return {
        fillColor: LOADING_FILL,
        weight: 1.5,
        opacity: 0.8,
        color: LOADING_STROKE,
        dashArray: "",
        fillOpacity: 0.25,
      };
    }

    const key = norm(zoneName);
    const stateKey = normalizedStates[key];
    const finalColor = stateColors[stateKey] || stateColors.green;

    return {
      fillColor: finalColor,
      weight: 2,
      opacity: 0.9,
      color: finalColor,
      dashArray: "",
      fillOpacity: 0.6,
    };
  };

  const getStateLabel = (state) =>
    state === "green"
      ? "Habilitado"
      : state === "yellow"
      ? "Precaución"
      : state === "red"
      ? "Cerrado"
      : "Desconocido";

  const onEachFeature = (feature, layer) => {
    const p = feature.properties || {};
    const zoneName = p.municipio
      ? p.municipio
      : p.serie
      ? `Melo (${p.serie})`
      : "";
    const nk = norm(zoneName);
    const stateKey = normalizedStates[nk];

    const department = p.depto || "Cerro Largo";
    const area = p.area_km2 != null ? Number(p.area_km2).toFixed(2) : "N/A";

    layer.bindPopup(
      `<b>${zoneName || "Zona"}</b><br>` +
        `Departamento: ${department}<br>` +
        `Área: ${area} km²<br>` +
        `Estado: ${stateKey ? getStateLabel(stateKey) : "Desconocido"}`
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
    <div className="w-full h-full">
      {/* Mensajes */}
      {message.text && (
        <div
          className={`absolute z-[1001] left-1/2 -translate-x-1/2 top-4 px-3 py-2 rounded shadow text-white ${
            message.type === "error" ? "bg-red-600" : "bg-green-600"
          }`}
        >
          {message.text}
          <button
            onClick={() => setMessage({ type: "", text: "" })}
            className="ml-2 text-sm"
          >
            ✕
          </button>
        </div>
      )}

      <MapContainer
        center={mapCenter}
        zoom={9}
        className="leaflet-container"
        style={{ width: "100%", height: "100%" }}
        whenCreated={(m) => (mapRef.current = m)}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Polígonos combinados (municipios + series) */}
        {combinedGeo && combinedGeo.features?.length > 0 && (
          <GeoJSON
            data={combinedGeo}
            style={getFeatureStyle}
            onEachFeature={onEachFeature}
            key={`combined-${JSON.stringify(normalizedStates)}`}
          />
        )}

        {/* Caminería (carga diferida y visible solo al acercar) */}
        {showRoads && (
          <GeoJSON
            data={caminosData}
            style={(f) => getRoadStyle(f, currentZoom)}
            onEachFeature={onEachRoadFeature}
            key={`caminos-layer-zoom-${currentZoom}`}
            pathOptions={{ interactive: true, bubblingMouseEvents: false }}
          />
        )}

        {/* Ubicación usuario (opcional) */}
        {userLocation && (
          <Marker
            position={[userLocation.lat, userLocation.lng]}
            icon={gpsIcon}
          >
            <Popup>
              <div className="text-center">
                <strong>Tu ubicación actual</strong>
                <br />
                <small>
                  Lat: {userLocation.lat.toFixed(6)}
                  <br />
                  Lng: {userLocation.lng.toFixed(6)}
                </small>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Alertas visibles (solo con zoom cercano) */}
        {showAlerts &&
          alerts.map((a) => (
            <Marker
              key={a.id || `${a.lat}-${a.lng}`}
              position={[a.lat, a.lng]}
              icon={attentionIcon}
            >
              <Popup>
                <div className="text-sm">
                  <strong>{a.titulo || "Atención"}</strong>
                  <br />
                  <small>{a.descripcion || ""}</small>
                </div>
              </Popup>
            </Marker>
          ))}

        <ZoomHandler onZoomChange={handleZoomChange} />
      </MapContainer>
    </div>
  );
}
