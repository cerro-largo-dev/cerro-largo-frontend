/**
 * Utilidades para el manejo y estilización de caminos
 */
import * as turf from '@turf/turf';

/**
 * Calcula la longitud de una geometría MultiLineString en kilómetros
 * @param {Object} geometry - Geometría GeoJSON MultiLineString
 * @returns {number} - Longitud en kilómetros
 */
export const calculateRoadLength = (geometry) => {
  try {
    if (geometry.type !== 'MultiLineString') {
      return 0;
    }
    
    let totalLength = 0;
    
    // Iterar sobre cada LineString en el MultiLineString
    geometry.coordinates.forEach(lineCoords => {
      if (lineCoords.length > 1) {
        // Crear una LineString temporal para calcular su longitud
        const lineString = turf.lineString(lineCoords);
        const length = turf.length(lineString, { units: 'kilometers' });
        totalLength += length;
      }
    });
    
    return Math.round(totalLength * 100) / 100; // Redondear a 2 decimales
  } catch (error) {
    console.error('Error calculando longitud del camino:', error);
    return 0;
  }
};

/**
 * Obtiene el color base del mapa oscurecido para los caminos
 * @param {string} baseColor - Color base en formato hex
 * @returns {string} - Color oscurecido
 */
export const getDarkenedColor = (baseColor = '#8B5CF6') => {
  // Convertir hex a HSL y reducir la luminosidad en 25%
  const hex = baseColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16) / 255;
  const g = parseInt(hex.substr(2, 2), 16) / 255;
  const b = parseInt(hex.substr(4, 2), 16) / 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;
  
  let h, s, l;
  
  // Calcular lightness
  l = (max + min) / 2;
  
  if (diff === 0) {
    h = s = 0; // achromatic
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
  
  // Convertir HSL de vuelta a RGB
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
    newR = newG = newB = l; // achromatic
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    newR = hue2rgb(p, q, h + 1/3);
    newG = hue2rgb(p, q, h);
    newB = hue2rgb(p, q, h - 1/3);
  }
  
  const toHex = (c) => {
    const hex = Math.round(c * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  
  return `#${toHex(newR)}${toHex(newG)}${toHex(newB)}`;
};

/**
 * Obtiene el estilo para un camino basado en sus propiedades y zoom level
 * @param {Object} feature - Feature GeoJSON del camino
 * @param {number} zoomLevel - Nivel de zoom actual del mapa (opcional)
 * @returns {Object} - Estilo de Leaflet
 */
export const getRoadStyle = (feature, zoomLevel = 10) => {
  const properties = feature.properties;
  const calzada = properties.calzada || '';
  
  // Determinar grosor base según tipo de calzada
  let baseWeight;
  let dashArray = '';
  
  if (calzada.includes('SE VE CALZADA')) {
    baseWeight = 2.5; // Caminos con calzada - más gruesos
  } else if (calzada.includes('SE VE HUELLA')) {
    baseWeight = 0.8; // Huellas - más delgados
    dashArray = '4, 4'; // Línea punteada para huellas
  } else {
    baseWeight = 1.5; // Otros tipos - grosor intermedio
    dashArray = '3, 3'; // Línea punteada para casos especiales
  }
  
  // Ajustar grosor según zoom level
  let weight = baseWeight;
  if (zoomLevel <= 9) {
    weight = baseWeight * 0.6; // Más delgado en zoom alejado
  } else if (zoomLevel <= 11) {
    weight = baseWeight * 0.8; // Intermedio
  } else if (zoomLevel >= 13) {
    weight = baseWeight * 1.3; // Más grueso en zoom cercano
  }
  
  // Color con transparencia para integrarse con la capa base
  const color = '#333333'; // Color neutro oscuro
  
  return {
    color: color,
    weight: Math.max(0.5, weight), // Mínimo 0.5px
    opacity: 0.6, // Más transparente para integrarse con la capa base
    dashArray: dashArray,
    lineCap: 'round',
    lineJoin: 'round'
  };
};

/**
 * Crea una función de estilo que se actualiza con el zoom
 * @param {Object} map - Instancia del mapa de Leaflet
 * @returns {Function} - Función de estilo para GeoJSON
 */
export const createResponsiveRoadStyle = (map) => {
  return (feature) => {
    const currentZoom = map ? map.getZoom() : 10;
    return getRoadStyle(feature, currentZoom);
  };
};

/**
 * Genera el contenido del popup para un camino (idéntico al formato de municipios)
 * @param {Object} feature - Feature GeoJSON del camino
 * @returns {string} - HTML del popup
 */
export const getRoadPopupContent = (feature) => {
  const props = feature.properties;
  const length = calculateRoadLength(feature.geometry);
  
  // Usar nombre si existe, sino usar código
  const displayName = props.nombre || props.codigo || 'Sin nombre';
  
  return (
    `<b>${displayName}</b><br>` +
    `Código: ${props.codigo || 'N/A'}<br>` +
    `Longitud: ${length} km<br>` +
    `Jurisdicción: ${props.jurisdiccion || 'N/A'}<br>` +
    `Categoría: ${props.categoria || 'N/A'}<br>` +
    `Tipo de calzada: ${props.calzada || 'N/A'}`
  );
};

/**
 * Configura los eventos para cada feature de camino
 * @param {Object} feature - Feature GeoJSON
 * @param {Object} layer - Layer de Leaflet
 */
export const onEachRoadFeature = (feature, layer) => {
  // Configurar popup (idéntico al de municipios)
  layer.bindPopup(getRoadPopupContent(feature));
  
  // Eventos de hover
  layer.on({
    mouseover: (e) => {
      const layer = e.target;
      layer.setStyle({
        weight: layer.options.weight + 2,
        opacity: 1
      });
    },
    mouseout: (e) => {
      const layer = e.target;
      layer.setStyle({
        weight: layer.options.weight - 2,
        opacity: 0.8
      });
    }
  });
};