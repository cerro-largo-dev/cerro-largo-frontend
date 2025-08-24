// src/components/MapComponent.jsx
import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
} from "react";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";

// Asegurate de tener estos assets (ajusta paths si cambian)
import combinedPolygonsUrl from "../assets/combined_polygons.geojson?url";
import caminosDataUrl from "../assets/camineria_cerro_largo.json?url";

import {
  ROAD_VIS_THRESHOLD,
  getRoadStyle,
  onEachRoadFeature,
} from "@/utils/caminosUtils";

// ------- Fix de íconos por defecto de Leaflet (evita 404 de imágenes) -------
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

// Ícono simple para ubicación del usuario
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

// Ícono de atención (alertas/avisos)
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

// ----------------- Utiles locales -----------------
const stateColors = { green: "#22c55e", yellow: "#eab308", red: "#ef4444" };
const LOADING_FILL = "#e5e7eb";
const LOADING_STROKE = "#9ca3af";

const norm = (s = "") =>
  String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[\s\-_().,/]+/g, "");

// Control para escuchar el zoom actual del mapa
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
// Componente principal
// ============================================================================
/**
 * Props esperadas (todas opcionales salvo las de mapa):
 * - zoneStates: objeto { [zoneName]: 'green'|'yellow'|'red' | {state:'...'} }
 * - onZoneStatesLoad(zones:string[])
 * - onZoneStateChange(name, state)
 * - onZonesLoad(zones:string[])
 * - userLocation: { lat, lng }
 * - alerts: [{ id, lat, lng, titulo, descripcion }]
 */
export default function MapComponent({
  zoneStates,
  onZoneStatesLoad,
  onZoneStateChange, // reservado por compatibilidad
  onZonesLoad,
  userLocation,
  alerts = [],
}) {
  const mapRef = useRef(null);
  const [currentZoom, setCurrentZoom] = useState(9);

  const [combinedGeo, setCombinedGeo] = useState(null);
  const [caminosData, setCaminosData] = useState(null);

  // Centro inicial en Cerro Largo
  const mapCenter = useMemo(() => [-32.35, -54.2], []);

  // Normaliza estados (permite { name: 'green' } o { name: {state:'green'} })
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

  // Cargar assets geo (polígonos y caminería)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [polyRes, camRes] = await Promise.all([
          fetch(combinedPolygonsUrl, { cache: "no-store" }),
          fetch(caminosDataUrl, { cache: "no-store" }),
        ]);
        if (!(polyRes.ok && camRes.ok)) throw new Error("No se pudieron cargar assets del mapa");
        const [polyJson, camJson] = await Promise.all([
          polyRes.json(),
          camRes.json(),
        ]);
        if (cancelled) return;

        setCombinedGeo(polyJson);
        setCaminosData(camJson);

        // Derivar lista de zonas para la UI superior, si se necesita
        const allZones = [];
        (polyJson.features || []).forEach((f) => {
          const p = f.properties || {};
          if (p.municipio) allZones.push(p.municipio);
          else if (p.serie) allZones.push(`Melo (${p.serie})`);
        });
        onZonesLoad && onZonesLoad(allZones);
        onZoneStatesLoad && onZoneStatesLoad(normalizedStates);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("Error cargando datos del mapa:", e);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Estilo de polígonos (municipios/series) según estado
  const polygonStyle = (feature) => {
    const p = feature?.properties || {};
    const zoneName = p.municipio ? p.municipio : p.serie ? `Melo (${p.serie})` : "";
    if (!zoneName) {
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

  const polygonOnEach = (feature, layer) => {
    const p = feature?.properties || {};
    const zoneName = p.municipio ? p.municipio : p.serie ? `Melo (${p.serie})` : "Zona";
    const department = p.depto || "Cerro Largo";
    const area = p.area_km2 != null ? Number(p.area_km2).toFixed(2) : "N/A";
    const st = normalizedStates[norm(zoneName)];
    const stLabel =
      st === "green" ? "Habilitado" : st === "yellow" ? "Precaución" : st === "red" ? "Cerrado" : "Desconocido";

    layer.bindPopup(
      `<b>${zoneName}</b><br/>Departamento: ${department}<br/>Área: ${area} km²<br/>Estado: ${stLabel}`
    );

    layer.on({
      mouseover: (e) => e.target.setStyle({ fillOpacity: 0.9 }),
      mouseout: (e) => e.target.setStyle({ fillOpacity: 0.6 }),
    });
  };

  const showRoads = currentZoom >= ROAD_VIS_THRESHOLD;

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
          attribution="&copy; OpenStreetMap"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Polígonos (municipios/series) */}
        {combinedGeo && (combinedGeo.features?.length || 0) > 0 && (
          <GeoJSON
            data={combinedGeo}
            style={polygonStyle}
            onEachFeature={polygonOnEach}
          />
        )}

        {/* Caminería: invisible al inicio; tenue y progresiva al acercar */}
        {showRoads && caminosData && (caminosData.features?.length || 0) > 0 && (
          <GeoJSON
            key={`roads-at-zoom-${currentZoom}`} // fuerza re-estilo al cambiar zoom
            data={caminosData}
            style={(f) => getRoadStyle(f, currentZoom)}
            onEachFeature={onEachRoadFeature}
            pathOptions={{ interactive: true, bubblingMouseEvents: false }}
          />
        )}

        {/* Ubicación del usuario (opcional) */}
        {userLocation && userLocation.lat != null && userLocation.lng != null && (
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

        {/* Alertas (opcional) */}
        {Array.isArray(alerts) &&
          alerts.map((a) =>
            a && a.lat != null && a.lng != null ? (
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
            ) : null
          )}

        <ZoomWatcher onZoom={setCurrentZoom} />
      </MapContainer>
    </div>
  );
}
