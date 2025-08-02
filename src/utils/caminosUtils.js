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
  
  // Color oscurecido basado en el color del mapa
  const color = getDarkenedColor('#3B82F6'); // Azul oscurecido
  
  return {
    color: color,
    weight: Math.max(0.5, weight), // Mínimo 0.5px
    opacity: 0.8,
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
 * Genera el contenido del popup para un camino
 * @param {Object} feature - Feature GeoJSON del camino
 * @returns {string} - HTML del popup
 */
export const getRoadPopupContent = (feature) => {
  const props = feature.properties;
  const length = calculateRoadLength(feature.geometry);
  
  // Usar nombre si existe, sino usar código
  const displayName = props.nombre || props.codigo || 'Sin nombre';
  
  // Función helper para formatear sentido
  const formatSentido = (sentido) => {
    if (!sentido) return '';
    if (sentido.includes('AMBOS SENTIDOS')) return 'Doble vía';
    if (sentido.includes('DIGITALIZACIÓN')) return 'Vía simple';
    return sentido;
  };
  
  // Función helper para formatear calzada
  const formatCalzada = (calzada) => {
    if (!calzada) return 'No especificada';
    if (calzada.includes('SE VE CALZADA')) return 'Calzada asfaltada/pavimentada';
    if (calzada.includes('SE VE HUELLA')) return 'Camino de tierra/huella';
    if (calzada.includes('SE VE FAJA')) return 'Faja sin calzada';
    if (calzada.includes('NO HAY FAJA')) return 'Sin infraestructura vial';
    if (calzada.includes('OCULTAMIENTOS')) return 'No visible en imagen';
    return calzada;
  };
  
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; min-width: 220px; max-width: 320px;">
      <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white; padding: 12px; margin: -12px -16px 12px -16px; border-radius: 8px 8px 0 0;">
        <h3 style="margin: 0; font-size: 16px; font-weight: 600;">
          🛣️ ${displayName}
        </h3>
        ${props.numero ? `<p style="margin: 2px 0 0 0; font-size: 12px; opacity: 0.9;">Ruta N° ${props.numero}</p>` : ''}
      </div>
      
      <div style="color: #374151; line-height: 1.4; font-size: 14px;">
        <div style="display: flex; align-items: center; margin: 8px 0; padding: 6px; background: #f8fafc; border-radius: 4px;">
          <span style="font-weight: 600; color: #059669;">📏 Longitud:</span>
          <span style="margin-left: 8px; font-weight: 500; color: #047857;">${length} km</span>
        </div>
        
        <div style="margin: 8px 0;">
          <p style="margin: 4px 0;"><span style="font-weight: 500; color: #6b7280;">🏷️ Código:</span> ${props.codigo || 'N/A'}</p>
          <p style="margin: 4px 0;"><span style="font-weight: 500; color: #6b7280;">🏛️ Jurisdicción:</span> ${props.jurisdiccion || 'N/A'}</p>
          <p style="margin: 4px 0;"><span style="font-weight: 500; color: #6b7280;">📋 Categoría:</span> ${props.categoria || 'N/A'}</p>
        </div>
        
        <div style="margin: 8px 0; padding: 6px; background: #fef3c7; border-radius: 4px; border-left: 3px solid #f59e0b;">
          <p style="margin: 2px 0;"><span style="font-weight: 500; color: #92400e;">🛤️ Tipo de vía:</span></p>
          <p style="margin: 2px 0 0 0; color: #b45309; font-size: 13px;">${formatCalzada(props.calzada)}</p>
        </div>
        
        ${props.sentido ? `
        <div style="margin: 8px 0;">
          <p style="margin: 4px 0;"><span style="font-weight: 500; color: #6b7280;">🚗 Circulación:</span> ${formatSentido(props.sentido)}</p>
        </div>
        ` : ''}
        
        ${props.observaciones ? `
        <div style="margin: 8px 0; padding: 6px; background: #eff6ff; border-radius: 4px; border-left: 3px solid #3b82f6;">
          <p style="margin: 2px 0; font-weight: 500; color: #1e40af;">💬 Observaciones:</p>
          <p style="margin: 2px 0 0 0; color: #1e40af; font-size: 13px;">${props.observaciones}</p>
        </div>
        ` : ''}
        
        <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af;">
          Fuente: ${props.fuente || 'No especificada'}${props.gid ? ` • ID: ${props.gid}` : ''}
        </div>
      </div>
    </div>
  `;
};

/**
 * Configura los eventos para cada feature de camino
 * @param {Object} feature - Feature GeoJSON
 * @param {Object} layer - Layer de Leaflet
 */
export const onEachRoadFeature = (feature, layer) => {
  // Configurar popup
  layer.bindPopup(getRoadPopupContent(feature), {
    maxWidth: 300,
    className: 'road-popup'
  });
  
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