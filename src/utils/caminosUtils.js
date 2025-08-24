// src/utils/caminosUtils.js
// Utilidades para el manejo y estilización de caminería con visibilidad por zoom
import * as turf from '@turf/turf';

// ---- Parámetros de visibilidad ----
// A partir de qué zoom se empieza a mostrar la caminería (oculta antes)
export const ROAD_VIS_THRESHOLD = 12; // p.ej. mapa arranca en 9; no se ve hasta >=12

// Curvas de estilo según zoom
function opacityForZoom(z) {
  if (z < 11) return 0.00; // totalmente oculto
  if (z < 12) return 0.12; // apenas sugerido
  if (z < 13) return 0.25; // tenue
  if (z < 14) return 0.45; // medio
  if (z < 15) return 0.70; // fuerte
  return 1.00;             // muy nítido
}

function weightForZoom(baseWeight, z) {
  if (z <= 9)  return Math.max(0.5, baseWeight * 0.45);
  if (z <= 11) return Math.max(0.8, baseWeight * 0.70);
  if (z >= 14) return baseWeight * 1.25;
  if (z >= 15) return baseWeight * 1.6;
  return baseWeight; // ~12–13
}

// ---- Métricas (tu lógica original, mantenida) ----
/**
 * Calcula la longitud de una geometría MultiLineString en kilómetros
 * @param {Object} geometry - Geometría GeoJSON MultiLineString
 * @returns {number} - Longitud en kilómetros
 */
export const calculateRoadLength = (geometry) => {
  try {
    if (!geometry || geometry.type !== 'MultiLineString') return 0;
    let totalLength = 0;
    for (const lineCoords of geometry.coordinates || []) {
      if (Array.isArray(lineCoords) && lineCoords.length > 1) {
        const ls = turf.lineString(lineCoords);
        totalLength += turf.length(ls, { units: 'kilometers' });
      }
    }
    return Math.round(totalLength * 100) / 100;
  } catch (error) {
    console.error('Error calculando longitud del camino:', error);
    return 0;
  }
};

/**
 * Obtiene un color oscurecido desde un hex base
 */
export const getDarkenedColor = (baseColor = '#8B5CF6') => {
  const hex = baseColor.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const diff = max - min;
  let h = 0, s = 0, l = (max + min) / 2;

  if (diff !== 0) {
    s = l > 0.5 ? diff / (2 - max - min) : diff / (max + min);
    switch (max) {
      case r: h = (g - b) / diff + (g < b ? 6 : 0); break;
      case g: h = (b - r) / diff + 2; break;
      case b: h = (r - g) / diff + 4; break;
    }
    h /= 6;
  }

  l = Math.max(0, l - 0.25); // oscurecer 25%

  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };

  let newR, newG, newB;
  if (s === 0) {
    newR = newG = newB = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    newR = hue2rgb(p, q, h + 1/3);
    newG = hue2rgb(p, q, h);
    newB = hue2rgb(p, q, h - 1/3);
  }

  const toHex = (c) => {
    const v = Math.round(c * 255).toString(16);
    return v.length === 1 ? '0' + v : v;
  };
  return `#${toHex(newR)}${toHex(newG)}${toHex(newB)}`;
};

// ---- Estilo dinámico por zoom ----
/**
 * Estilo para un camino según propiedades y zoom actual.
 * Oculto por debajo de ROAD_VIS_THRESHOLD (opacidad 0 y grosor 0).
 */
export const getRoadStyle = (feature, zoomLevel = 10) => {
  const props = feature?.properties || {};
  const calzada = String(props.calzada || '').toUpperCase();

  // Grosor base por tipo
  let baseWeight, dashArray = '';
  if (calzada.includes('SE VE CALZADA')) {
    baseWeight = 2.6;                       // calzada marcada
  } else if (calzada.includes('SE VE HUELLA')) {
    baseWeight = 1.3; dashArray = '4, 4';   // huella, punteado
  } else {
    baseWeight = 1.8; dashArray = '3, 3';   // indefinido/otros
  }

  // Si está por debajo del umbral, oculto total
  if (zoomLevel < ROAD_VIS_THRESHOLD) {
    return {
      color: '#333333',
      weight: 0,
      opacity: 0,
      dashArray,
      lineCap: 'round',
      lineJoin: 'round',
    };
  }

  // Visible y progresivo al acercar
  const weight = weightForZoom(baseWeight, zoomLevel);
  const opacity = opacityForZoom(zoomLevel);

  return {
    color: '#333333',     // gris neutro
    weight: Math.max(1, weight),
    opacity,
    dashArray,
    lineCap: 'round',
    lineJoin: 'round',
  };
};

/**
 * Crea una función de estilo dependiente del zoom del mapa
 */
export const createResponsiveRoadStyle = (map) => {
  return (feature) => {
    const z = map ? map.getZoom() : 10;
    return getRoadStyle(feature, z);
  };
};

/**
 * Popup para un camino (igual formato que municipios)
 */
export const getRoadPopupContent = (feature) => {
  const p = feature?.properties || {};
  const length = calculateRoadLength(feature?.geometry);
  const displayName = p.nombre || p.codigo || 'Sin nombre';

  return (
    `<b>${displayName}</b><br>` +
    `Código: ${p.codigo || 'N/A'}<br>` +
    `Longitud: ${length} km<br>` +
    `Jurisdicción: ${p.jurisdiccion || 'N/A'}<br>` +
    `Categoría: ${p.categoria || 'N/A'}<br>` +
    `Tipo de calzada: ${p.calzada || 'N/A'}`
  );
};

/**
 * Eventos por camino con mejor detección de clics.
 * Si está oculto (zoom < umbral) no creamos hit-area ampliada.
 */
export const onEachRoadFeature = (feature, layer) => {
  layer.bindPopup(getRoadPopupContent(feature));

  const originalWeight = layer.options.weight;

  layer.on('add', function () {
    const map = layer._map;
    if (!map) return;

    const z = map.getZoom();
    // Si está oculto, evitamos crear el clon para clic (no hay nada que ver)
    if (z < ROAD_VIS_THRESHOLD) return;

    if (this._path) {
      this._path.style.cursor = 'pointer';
      const clickLayer = this._path.cloneNode(true);
      clickLayer.setAttribute('stroke', 'transparent');
      clickLayer.setAttribute('stroke-width', String(Math.max(15, (originalWeight || 1) * 6)));
      clickLayer.setAttribute('fill', 'none');
      clickLayer.style.pointerEvents = 'visibleStroke';

      this._path.parentNode.insertBefore(clickLayer, this._path);

      const self = this;
      clickLayer.addEventListener('click', function (e) {
        e.stopPropagation();
        self.openPopup();
      });
      clickLayer.addEventListener('mouseover', function (e) {
        self.fire('mouseover', e);
      });
      clickLayer.addEventListener('mouseout', function (e) {
        self.fire('mouseout', e);
      });
    }
  });

  // Hover feedback (solo afecta cuando es visible)
  layer.on({
    mouseover: (e) => {
      const map = e.target._map;
      if (map && map.getZoom() < ROAD_VIS_THRESHOLD) return;
      e.target.setStyle({ weight: (originalWeight || 1) + 2, opacity: 1, color: '#1e40af' });
    },
    mouseout: (e) => {
      const map = e.target._map;
      if (map && map.getZoom() < ROAD_VIS_THRESHOLD) return;
      e.target.setStyle({ weight: originalWeight || 1, opacity: opacityForZoom(map ? map.getZoom() : 10), color: '#333333' });
    },
  });
};
