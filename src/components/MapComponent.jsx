// src/components/MapComponent.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap, Popup, Marker } from 'react-leaflet';
import L from 'leaflet';

import combinedPolygonsUrl from '../assets/combined_polygons.geojson?url';

// Si usas caminería/alertas, deja estos imports. Si no, puedes quitarlos.
import { ROAD_VIS_THRESHOLD, getRoadStyle, onEachRoadFeature, REPORT_VIS_THRESHOLD } from '../utils/caminosUtils';

// ---------- Ajustes Leaflet ----------
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// ---------- Constantes ----------
const stateColors = { green: '#22c55e', yellow: '#eab308', red: '#ef4444' };
const LOADING_FILL = '#e5e7eb';
const LOADING_STROKE = '#9ca3af';

const LABEL_MAX_ZOOM = 10; // Mostrar etiquetas SOLO cuando el zoom es <= 10 (lejos)
const GRID_N = 14;         // resolución del muestreo interior (más alto = más preciso)
const LABEL_FONT_MIN = 18; // tamaño mínimo (px) para zoom lejanos

// ---------- Utils ----------
const norm = (s = '') =>
  String(s)
    .toLowerCase()
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(/[\s\-_().,/]+/g, '');

const getZoneNameFromProps = (p = {}) => (p.municipio ? p.municipio : (p.serie ? `Melo (${p.serie})` : ''));

// 3 letras (o serie p.ej. "GBA")
const zoneAbbr3 = (zoneName = '') => {
  const serie = zoneName.match(/\(([^)]+)\)/);
  if (serie) return (serie[1] || '').replace(/[^A-Za-zÁÉÍÓÚÜÑ]/g, '').slice(0, 3).toUpperCase();
  const cleaned = zoneName.replace(/\(.*?\)/g, '').trim();
  const noDia = cleaned.normalize('NFD').replace(/\p{Diacritic}/gu, '');
  const firstWord = (noDia.split(/\s+/)[0] || '');
  return firstWord.slice(0, 3).toUpperCase();
};

// tamaño de fuente (px) según zoom lejano
const labelFontSizePx = (zoom) => {
  const base = LABEL_FONT_MIN + Math.max(0, (10 - zoom)) * 0.5; // leve ajuste
  return Math.round(base);
};

// ---------- Geometría simple (ray casting y distancias) ----------
function pointInRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
function pointInPolygon(pt, rings) {
  if (!rings || !rings.length) return false;
  const insideOuter = pointInRing(pt, rings[0]);
  if (!insideOuter) return false;
  for (let k = 1; k < rings.length; k++) {
    if (pointInRing(pt, rings[k])) return false; // está en un agujero
  }
  return true;
}
function segDist([px, py], [ax, ay], [bx, by]) {
  const vx = bx - ax, vy = by - ay;
  const wx = px - ax, wy = py - ay;
  const c1 = vx * wx + vy * wy;
  if (c1 <= 0) return Math.hypot(px - ax, py - ay);
  const c2 = vx * vx + vy * vy;
  if (c2 <= c1) return Math.hypot(px - bx, py - by);
  const t = c1 / c2;
  const cx = ax + t * vx, cy = ay + t * vy;
  return Math.hypot(px - cx, py - cy);
}
function distToRings([px, py], rings) {
  let dmin = Infinity;
  for (const ring of rings) {
    for (let i = 0; i < ring.length - 1; i++) {
      const a = ring[i], b = ring[i + 1];
      dmin = Math.min(dmin, segDist([px, py], a, b));
    }
  }
  return dmin;
}
// bbox de múltiples anillos
function bboxOfRings(allRings) {
  let minX =  Infinity, minY =  Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const rings of allRings) {
    for (const ring of rings) {
      for (const [x, y] of ring) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  return [minX, minY, maxX, maxY];
}
// extrae arreglo de polígonos (cada uno = rings[]) de un geometry
function polygonsFromGeometry(geom) {
  const polys = [];
  if (!geom) return polys;
  if (geom.type === 'Polygon') {
    polys.push(geom.coordinates.map(r => r.map(([lng, lat]) => [lng, lat])));
  } else if (geom.type === 'MultiPolygon') {
    for (const poly of geom.coordinates) {
      polys.push(poly.map(r => r.map(([lng, lat]) => [lng, lat])));
    }
  }
  return polys;
}
// mejor punto interior por polígono (muestra una grilla y elige el más alejado del borde)
function bestInteriorPointForPolygon(rings, gridN = GRID_N) {
  const [minX, minY, maxX, maxY] = bboxOfRings([rings]);
  if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) return null;

  let best = null; // {pt:[x,y], d:number}
  for (let gy = 0; gy <= gridN; gy++) {
    for (let gx = 0; gx <= gridN; gx++) {
      const x = minX + (gx / gridN) * (maxX - minX);
      const y = minY + (gy / gridN) * (maxY - minY);
      const pt = [x, y];
      if (pointInPolygon(pt, rings)) {
        const d = distToRings(pt, rings);
        if (!best || d > best.d) best = { pt, d };
      }
    }
  }
  // fallback al centroide del anillo exterior si no encontró celda (polígono muy angosto)
  if (!best) {
    const outer = rings[0];
    let sx = 0, sy = 0;
    for (const [x, y] of outer) { sx += x; sy += y; }
    const c = [sx / outer.length, sy / outer.length];
    if (pointInPolygon(c, rings)) return { pt: c, d: 0 };
    // último recurso: centro del bbox
    const cbox = [(minX + maxX) / 2, (minY + maxY) / 2];
    return { pt: cbox, d: 0 };
  }
  return best;
}
// mejor punto interior para toda la geometría (elige el mejor entre sub-polígonos)
function bestInteriorPointForGeometry(geom, gridN = GRID_N) {
  const polys = polygonsFromGeometry(geom);
  if (!polys.length) return null;
  let globalBest = null;
  for (const rings of polys) {
    const cand = bestInteriorPointForPolygon(rings, gridN);
    if (cand && (!globalBest || cand.d > globalBest.d)) globalBest = cand;
  }
  return globalBest ? globalBest.pt : null;
}

// ---------- Zoom handler ----------
function ZoomHandler({ onZoomChange }) {
  const map = useMap();
  useEffect(() => {
    const handleZoom = () => onZoomChange(map.getZoom());
    map.on('zoomend', handleZoom);
    onZoomChange(map.getZoom());
    return () => map.off('zoomend', handleZoom);
  }, [map, onZoomChange]);
  return null;
}

// ---------- Componente principal ----------
function MapComponent({
  zoneStates = {},       // { "Río Branco": "green", ... } o { states: { ... } }
  onZoneStatesLoad,
  onZonesLoad,
  userLocation,
  alerts = [],
}) {
  const [combinedGeo, setCombinedGeo] = useState(null);
  const [currentZoom, setCurrentZoom] = useState(9);
  const mapRef = useRef(null);

  // Derivar estados normalizados
  const normalizedStates = useMemo(() => {
    const out = {};
    const base = zoneStates.states && typeof zoneStates.states === 'object'
      ? zoneStates.states
      : zoneStates;
    for (const [k, v] of Object.entries(base || {})) {
      const stateVal = typeof v === 'string' ? v : (v && v.state);
      if (!stateVal) continue;
      out[norm(k)] = String(stateVal).toLowerCase();
    }
    return out;
  }, [zoneStates]);

  // Cargar polígonos combinados
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(combinedPolygonsUrl, { cache: 'no-store' });
        if (!res.ok) throw new Error('No se pudo cargar combined_polygons.geojson');
        const json = await res.json();
        if (!cancelled) {
          setCombinedGeo(json);
          // Lista de zonas
          const zs = [];
          (json.features || []).forEach((f) => {
            const p = f.properties || {};
            if (p.municipio) zs.push(p.municipio);
            else if (p.serie) zs.push(`Melo (${p.serie})`);
          });
          onZonesLoad && onZonesLoad(zs);
        }
      } catch (e) {
        console.error(e);
      }
    })();
    return () => { cancelled = true; };
  }, [onZonesLoad]);

  // Estilo de polígonos (se colorean por estado)
  const getFeatureStyle = (feature) => {
    const p = feature.properties || {};
    const zoneName = getZoneNameFromProps(p);
    const key = norm(zoneName);
    const stateKey = normalizedStates[key];
    const color = stateColors[stateKey] || stateColors.green;
    return { fillColor: color, weight: 2, opacity: 0.9, color, dashArray: '', fillOpacity: 0.6 };
  };

  const onEachFeature = (feature, layer) => {
    const p = feature.properties || {};
    const zoneName = getZoneNameFromProps(p);
    const nk = norm(zoneName);
    const stateKey = normalizedStates[nk];
    const stateLabel =
      stateKey === 'green' ? 'Habilitado' :
      stateKey === 'yellow' ? 'Precaución' :
      stateKey === 'red' ? 'Cerrado' : 'Desconocido';
    layer.bindPopup(`<b>${zoneName || 'Zona'}</b><br/>Estado: ${stateLabel}`);
    layer.on({
      mouseover: (e) => e.target.setStyle({ fillOpacity: 0.9 }),
      mouseout:  (e) => e.target.setStyle({ fillOpacity: 0.6 }),
    });
  };

  // Posiciones interiores para etiquetas (siempre DENTRO)
  const labelAnchors = useMemo(() => {
    if (!combinedGeo?.features?.length) return [];
    return combinedGeo.features.map((f, i) => {
      const p = f.properties || {};
      const zoneName = getZoneNameFromProps(p);
      if (!zoneName) return null;

      const pt = bestInteriorPointForGeometry(f.geometry, GRID_N);
      if (!pt) return null;

      // GeoJSON está en [lng, lat] -> Leaflet usa [lat, lng]
      const [lng, lat] = pt;
      return { id: i, zoneName, lat, lng };
    }).filter(Boolean);
  }, [combinedGeo]);

  // Color por estado (para el texto). Si no hay estado, usa verde por defecto
  const resolveZoneColor = useCallback((zoneName) => {
    const key = norm(zoneName);
    const stateKey = normalizedStates[key];
    return stateColors[stateKey] || stateColors.green;
  }, [normalizedStates]);

  const showLabels = currentZoom <= LABEL_MAX_ZOOM;

  return (
    <div className="w-full h-full">
      <MapContainer
        center={[-32.35, -54.20]}
        zoom={9}
        className="leaflet-container"
        style={{ width: '100%', height: '100%' }}
        whenCreated={(m) => (mapRef.current = m)}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Polígonos coloreados */}
        {combinedGeo && combinedGeo.features?.length > 0 && (
          <GeoJSON
            data={combinedGeo}
            style={getFeatureStyle}
            onEachFeature={onEachFeature}
          />
        )}

        {/* Etiquetas: SOLO 3 letras, negrita, SIN sombra; desaparecen al acercar */}
        {showLabels && labelAnchors.map(({ id, zoneName, lat, lng }) => {
          const text = zoneAbbr3(zoneName);               // SIEMPRE 3 letras
          const color = resolveZoneColor(zoneName);
          const fontSize = labelFontSizePx(currentZoom);  // tamaño moderado para evitar desbordes

          const icon = L.divIcon({
            className: 'zone-label',
            html: `
              <div style="
                pointer-events:none;
                font-weight:800;
                font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, 'Helvetica Neue', Arial, 'Noto Sans', 'Liberation Sans', sans-serif;
                font-size:${fontSize}px;
                line-height:1;
                letter-spacing:1px;
                color:${color};
                opacity:1;
                text-transform:uppercase;
                white-space:nowrap;
              ">${text}</div>
            `,
            iconSize: [0, 0],
            iconAnchor: [0, 0],
          });

          return (
            <Marker
              key={`label-${id}-${currentZoom}`}
              position={[lat, lng]}   // punto INTERIOR robusto
              icon={icon}
              interactive={false}
              bubblingMouseEvents={false}
              keyboard={false}
              opacity={1}
            />
          );
        })}

        {/* (Opcional) Capas extra si las usas */}
        {/* Caminería (visible solo con zoom alto) */}
        {/* 
        {currentZoom >= ROAD_VIS_THRESHOLD && caminosData && (
          <GeoJSON
            data={caminosData}
            style={(f) => getRoadStyle(f, currentZoom)}
            onEachFeature={onEachRoadFeature}
            pathOptions={{ interactive: true, bubblingMouseEvents: false }}
          />
        )} 
        */}

        <ZoomHandler onZoomChange={setCurrentZoom} />
      </MapContainer>
    </div>
  );
}

export default MapComponent;
