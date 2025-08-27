/**
 * Utilidades para el manejo y estilización de caminos
 */
import * as turf from '@turf/turf';

/** Umbral de zoom para mostrar/consultar caminería */
export const ROAD_VIS_THRESHOLD = 12;

/**
 * Extrae todas las líneas (arrays de coords) de una geometría GeoJSON.
 * Soporta: Feature, LineString, MultiLineString, GeometryCollection.
 * @param {Object} geomOrFeature - geometry o feature GeoJSON
 * @returns {Array<Array<[number, number]>>} lista de arrays de coordenadas (cada uno representa una LineString)
 */
const extractLineArrays = (geomOrFeature) => {
  if (!geomOrFeature) return [];

  // Si viene un Feature, tomar su geometry
  const geometry = geomOrFeature.type === 'Feature'
    ? geomOrFeature.geometry
    : geomOrFeature;

  if (!geometry) return [];

  const { type, coordinates, geometries } = geometry;

  if (type === 'LineString') {
    return Array.isArray(coordinates) ? [coordinates] : [];
  }

  if (type === 'MultiLineString') {
    return Array.isArray(coordinates) ? coordinates.filter(arr => Array.isArray(arr)) : [];
  }

  if (type === 'GeometryCollection' && Array.isArray(geometries)) {
    // Aplanar recursivamente todas las líneas dentro de la colección
    return geometries.flatMap(g => extractLineArrays(g));
  }

  // Otros tipos (Polygon, MultiPolygon, Point, etc.) no aplican para caminos
  return [];
};

/**
 * Calcula la longitud total en kilómetros de una geometría o feature de camino.
 * Tolera LineString, MultiLineString, Feature y GeometryCollection.
 * @param {Object} geomOrFeature - geometry o feature GeoJSON
 * @returns {number} longitud en kilómetros (número en km, sin formato)
 */
export const calculateRoadLength = (geomOrFeature) => {
  try {
    const lines = extractLineArrays(geomOrFeature);
    if (!lines.length) return 0;

    let totalKm = 0;
    for (const coords of lines) {
      if (Array.isArray(coords) && coords.length > 1) {
        // GeoJSON es [lng, lat]; turf.lineString espera ese orden
        const line = turf.lineString(coords);
        totalKm += turf.length(line, { units: 'kilometers' });
      }
    }
    return totalKm;
  } catch (err) {
    console.error('Error calculando longitud del camino:', err);
    return 0;
  }
};

/**
 * Devuelve un string legible para la longitud:
 * - < 1 km → se muestra en metros con 0 decimales (ej. "750 m")
 * - ≥ 1 km → km con 2 decimales (ej. "12.34 km")
 * @param {number} lengthKm
 * @returns {string}
 */
export const formatLength = (lengthKm) => {
  if (!Number.isFinite(lengthKm) || lengthKm <= 0) return '0 m';
  if (lengthKm < 1) {
    const meters = Math.round(lengthKm * 1000);
    return `${meters} m`;
  }
  return `${(Math.round(lengthKm * 100) / 100).toFixed(2)} km`;
};

/**
 * Oscurece un color base (hex) para usar en caminos
 */
export const getDarkenedColor = (baseColor = '#8B5CF6') => {
  const hex = baseColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16) / 255;
  const g = parseInt(hex.substr(2, 2), 16) / 255;
  const b = parseInt(hex.substr(4, 2), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;

  let h, s, l;
  l = (max + min) / 2;

  if (diff === 0) {
    h = s = 0; // acromático
  } else {
    s = l > 0.5 ? diff / (2 - max - min) : diff / (max + min);
    switch (max) {
      case r: h = (g - b) / diff + (g < b ? 6 : 0); break;
      case g: h = (b - r) / diff + 2; break;
      case b: h = (r - g) / diff + 4; break;
    }
    h /= 6;
  }

  // Reducir luminosidad en 25%
  l = Math.max(0, l - 0.25);

  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
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
    const h = Math.round(c * 255).toString(16);
    return h.length === 1 ? '0' + h : h;
  };

  return `#${toHex(newR)}${toHex(newG)}${toHex(newB)}`;
};

/**
 * Estilo de caminos según propiedades y zoom
 * @param {Object} feature - Feature GeoJSON del camino
 * @param {number} zoomLevel - Nivel de zoom actual del mapa (opcional)
 * @returns {Object} - Estilo de Leaflet
 */
export const getRoadStyle = (feature, zoomLevel = 9) => {
  const properties = feature?.properties ?? {};
  const calzada = properties.calzada || '';

  let baseWeight;
  let dashArray = '';

  if (calzada.includes('SE VE CALZADA')) {
    baseWeight = 3;
  } else if (calzada.includes('SE VE HUELLA')) {
    baseWeight = 1.5;
    dashArray = '4, 4';
  } else {
    baseWeight = 2;
    dashArray = '3, 3';
  }

  let weight = baseWeight;
  if (zoomLevel <= 9) {
    weight = baseWeight * 0.6;
  } else if (zoomLevel <= 11) {
    weight = baseWeight * 0.8;
  } else if (zoomLevel >= 13) {
    weight = baseWeight * 1.3;
  }

  return {
    color: '#333333',
    weight: Math.max(1.5, weight),
    opacity: 0.6,
    dashArray,
    lineCap: 'round',
    lineJoin: 'round'
  };
};

/** Crea función de estilo sensible al zoom */
export const createResponsiveRoadStyle = (map) => {
  return (feature) => {
    const currentZoom = map ? map.getZoom() : 10;
    return getRoadStyle(feature, currentZoom);
  };
};

/**
 * Popup de caminos con longitud (metros o km)
 */
export const getRoadPopupContent = (feature) => {
  const props = feature?.properties ?? {};
  // Si ya viene una longitud pre-calculada en props, úsala; si no, calcúlala.
  const lengthKmProp = Number(props.length_km);
  const lengthKm = Number.isFinite(lengthKmProp) && lengthKmProp > 0
    ? lengthKmProp
    : calculateRoadLength(feature);

  const lengthText = formatLength(lengthKm);
  const displayName = props.nombre || props.codigo || 'Sin nombre';

  return (
    `<b>${displayName}</b><br>` +
    `Código: ${props.codigo || 'N/A'}<br>` +
    `Longitud: ${lengthText}<br>` +
    `Jurisdicción: ${props.jurisdiccion || 'N/A'}<br>` +
    `Categoría: ${props.categoria || 'N/A'}<br>` +
    `Tipo de calzada: ${props.calzada || 'N/A'}`
  );
};

/**
 * Eventos por feature de camino con mejor detección de clics
 */
export const onEachRoadFeature = (feature, layer) => {
  // Popup
  layer.bindPopup(getRoadPopupContent(feature));

  const originalWeight = layer.options.weight;

  layer.on('add', function() {
    if (this._path) {
      this._path.style.cursor = 'pointer';

      // Capa invisible ampliada para captar clics (zona más ancha)
      const clickLayer = this._path.cloneNode(true);
      clickLayer.setAttribute('stroke', 'transparent');
      clickLayer.setAttribute('stroke-width', Math.max(15, originalWeight * 6));
      clickLayer.setAttribute('fill', 'none');
      clickLayer.style.pointerEvents = 'visibleStroke';

      this._path.parentNode.insertBefore(clickLayer, this._path);

      const self = this;
      clickLayer.addEventListener('click', function(e) {
        e.stopPropagation();
        self.openPopup();
      });
      clickLayer.addEventListener('mouseover', function(e) {
        self.fire('mouseover', e);
      });
      clickLayer.addEventListener('mouseout', function(e) {
        self.fire('mouseout', e);
      });
    }
  });

  // Hover feedback
  layer.on({
    mouseover: (e) => {
      const target = e.target;
      target.setStyle({
        weight: originalWeight + 2,
        opacity: 1,
        color: '#1e40af'
      });
    },
    mouseout: (e) => {
      const target = e.target;
      target.setStyle({
        weight: originalWeight,
        opacity: 0.6,
        color: '#333333'
      });
    }
  });
};


/** Umbral de zoom para mostrar reportes ciudadanos */
export const REPORT_VIS_THRESHOLD = 10;


