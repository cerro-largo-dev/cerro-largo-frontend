/**
 * Utilidades para caminería (estilos, cálculo de longitudes y selección por camino)
 */
import * as turf from '@turf/turf';

/** Umbral de zoom para mostrar/consultar caminería */
export const ROAD_VIS_THRESHOLD = 12;

/* ===================== CÁLCULO DE LONGITUD ===================== */

/**
 * Extrae arrays de coordenadas de líneas desde geo/feature GeoJSON.
 * Soporta Feature, LineString, MultiLineString, GeometryCollection.
 */
const extractLineArrays = (geomOrFeature) => {
  if (!geomOrFeature) return [];
  const geometry = geomOrFeature.type === 'Feature' ? geomOrFeature.geometry : geomOrFeature;
  if (!geometry) return [];

  const { type, coordinates, geometries } = geometry;

  if (type === 'LineString') return Array.isArray(coordinates) ? [coordinates] : [];
  if (type === 'MultiLineString') return Array.isArray(coordinates) ? coordinates.filter(Array.isArray) : [];
  if (type === 'GeometryCollection' && Array.isArray(geometries)) {
    return geometries.flatMap(g => extractLineArrays(g));
  }
  return [];
};

/** Longitud total en km de una geometría/feature de camino. */
export const calculateRoadLength = (geomOrFeature) => {
  try {
    const lines = extractLineArrays(geomOrFeature);
    if (!lines.length) return 0;
    let totalKm = 0;
    for (const coords of lines) {
      if (Array.isArray(coords) && coords.length > 1) {
        totalKm += turf.length(turf.lineString(coords), { units: 'kilometers' });
      }
    }
    return totalKm;
  } catch (err) {
    console.error('Error calculando longitud del camino:', err);
    return 0;
  }
};

/** Formatea longitud: <1 km en m; >=1 km con 2 decimales. */
export const formatLength = (lengthKm) => {
  if (!Number.isFinite(lengthKm) || lengthKm <= 0) return '0 m';
  if (lengthKm < 1) return `${Math.round(lengthKm * 1000)} m`;
  return `${(Math.round(lengthKm * 100) / 100).toFixed(2)} km`;
};

/* ===================== ESTILOS ===================== */

/** Oscurece un color hex (para caminos) */
export const getDarkenedColor = (baseColor = '#8B5CF6') => {
  const hex = baseColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16) / 255;
  const g = parseInt(hex.substr(2, 2), 16) / 255;
  const b = parseInt(hex.substr(4, 2), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), diff = max - min;
  let h, s, l = (max + min) / 2;

  if (diff === 0) { h = s = 0; }
  else {
    s = l > 0.5 ? diff / (2 - max - min) : diff / (max + min);
    switch (max) { case r: h = (g - b) / diff + (g < b ? 6 : 0); break;
      case g: h = (b - r) / diff + 2; break; case b: h = (r - g) / diff + 4; break; }
    h /= 6;
  }
  l = Math.max(0, l - 0.25);

  const hue2rgb = (p, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p; };

  let newR, newG, newB;
  if (s === 0) { newR = newG = newB = l; }
  else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const hue = (t) => hue2rgb(p, q, t);
    newR = hue(h + 1/3); newG = hue(h); newB = hue(h - 1/3);
  }
  const toHex = (c) => { const h = Math.round(c * 255).toString(16); return h.length === 1 ? '0' + h : h; };
  return `#${toHex(newR)}${toHex(newG)}${toHex(newB)}`;
};

/** Estilo de caminos según propiedades y zoom */
export const getRoadStyle = (feature, zoomLevel = 10) => {
  const calzada = feature?.properties?.calzada || '';
  let baseWeight, dashArray = '';
  if (calzada.includes('SE VE CALZADA')) baseWeight = 3;
  else if (calzada.includes('SE VE HUELLA')) { baseWeight = 1.5; dashArray = '4, 4'; }
  else { baseWeight = 2; dashArray = '3, 3'; }

  let weight = baseWeight;
  if (zoomLevel <= 9) weight = baseWeight * 0.6;
  else if (zoomLevel <= 11) weight = baseWeight * 0.8;
  else if (zoomLevel >= 13) weight = baseWeight * 1.3;

  return { color: '#333333', weight: Math.max(1.5, weight), opacity: 0.6, dashArray, lineCap: 'round', lineJoin: 'round' };
};

/** Función de estilo dependiente del zoom (para L.geoJSON) */
export const createResponsiveRoadStyle = (map) => (feature) => getRoadStyle(feature, map ? map.getZoom() : 10);

/* ===================== POPUPS ===================== */

export const getRoadPopupContent = (feature) => {
  const props = feature?.properties ?? {};
  const lengthKmProp = Number(props.length_km);
  const lengthKm = Number.isFinite(lengthKmProp) && lengthKmProp > 0 ? lengthKmProp : calculateRoadLength(feature);
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

/* ===================== SELECCIÓN POR CAMINO ===================== */

/** Obtiene la clave de agrupación (por defecto 'codigo', fallback 'nombre'). */
const getRoadKey = (props, keyFields = ['codigo', 'nombre']) => {
  if (!props) return null;
  for (const k of keyFields) {
    const v = props[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return null;
};

/**
 * Gestor de selección de caminos: indexa capas por 'codigo'/'nombre' y
 * permite seleccionar todos los tramos del mismo camino.
 *
 * Uso:
 *  const sel = createRoadSelectionManager(map, { keyFields: ['codigo','nombre'] });
 *  onEachFeature: (f,l)=> { onEachRoadFeature(f,l,{selectionManager: sel}); l.on('click', ()=> sel.selectByFeature(f,{fitBounds:true,showGroupPopup:true})) }
 */
export const createRoadSelectionManager = (map, opts = {}) => {
  const keyFields = opts.keyFields || ['codigo', 'nombre'];
  const highlightStyle = opts.highlightStyle || { color: '#d97706', opacity: 1, weightDelta: 2 }; // ámbar
  const index = new Map(); // key -> { items:[{layer, feature, lengthKm, bounds, originalStyle}], totalKm, bounds }
  let currentKey = null;
  let groupPopupOpen = false;

  const ensureEntry = (key) => {
    if (!index.has(key)) index.set(key, { items: [], totalKm: 0, bounds: null });
    return index.get(key);
  };

  const register = (feature, layer) => {
    const key = getRoadKey(feature?.properties, keyFields);
    if (!key) return;
    const entry = ensureEntry(key);
    const lengthKm = calculateRoadLength(feature);
    const bounds = typeof layer.getBounds === 'function' ? layer.getBounds() : null;

    // fusionar bounds
    if (bounds) {
      if (!entry.bounds) entry.bounds = bounds;
      else entry.bounds.extend(bounds);
    }
    entry.items.push({
      layer,
      feature,
      lengthKm,
      bounds,
      originalStyle: { ...layer.options }
    });
    entry.totalKm += lengthKm;
  };

  const clearSelection = () => {
    if (!currentKey) return;
    const entry = index.get(currentKey);
    if (entry) {
      for (const it of entry.items) {
        // restaurar estilo original
        const o = it.originalStyle || {};
        it.layer.setStyle({
          color: o.color ?? '#333333',
          opacity: o.opacity ?? 0.6,
          weight: o.weight ?? 2,
          dashArray: o.dashArray ?? (o['dashArray'] || '')
        });
        if (it.layer.bringToBack) it.layer.bringToBack();
      }
    }
    currentKey = null;
    if (groupPopupOpen) {
      map && map.closePopup();
      groupPopupOpen = false;
    }
  };

  const applyHighlight = (entry) => {
    for (const it of entry.items) {
      const o = it.originalStyle || {};
      const baseWeight = o.weight ?? 2;
      it.layer.setStyle({
        color: highlightStyle.color,
        opacity: highlightStyle.opacity ?? 1,
        weight: Math.max( baseWeight + (highlightStyle.weightDelta ?? 2), baseWeight + 1 ),
        dashArray: '' // sólido al resaltar
      });
      if (it.layer.bringToFront) it.layer.bringToFront();
    }
  };

  const getGroupPopupContent = (key, entry) => {
    const props = entry.items[0]?.feature?.properties ?? {};
    const nombre = props.nombre || null;
    const codigo = props.codigo || null;
    const totalTxt = formatLength(entry.totalKm);
    const n = entry.items.length;

    return (
      `<b>${nombre || codigo || key}</b><br>` +
      (codigo ? `Código: ${codigo}<br>` : '') +
      (nombre ? `Nombre: ${nombre}<br>` : '') +
      `Tramos: ${n}<br>` +
      `Longitud total: ${totalTxt}`
    );
  };

  const selectByKey = (key, options = {}) => {
    const entry = index.get(key);
    if (!entry) return;
    if (currentKey === key) return;

    clearSelection();
    currentKey = key;
    applyHighlight(entry);

    if (options.fitBounds && entry.bounds && map?.fitBounds) {
      map.fitBounds(entry.bounds, { padding: [20, 20] });
    }
    if (options.showGroupPopup && map?.openPopup && entry.bounds) {
      const center = entry.bounds.getCenter();
      map.openPopup(getGroupPopupContent(key, entry), center);
      groupPopupOpen = true;
    }
  };

  const selectByFeature = (feature, options = {}) => {
    const key = getRoadKey(feature?.properties, keyFields);
    if (!key) return;
    selectByKey(key, options);
  };

  return {
    register,
    clearSelection,
    selectByKey,
    selectByFeature,
    _debugIndex: index
  };
};

/* ===================== onEachFeature con click amplio ===================== */

/**
 * Configura eventos por feature; deja el click ampliado y
 * avisa al selectionManager (si fue pasado en options).
 */
export const onEachRoadFeature = (feature, layer, options = {}) => {
  const selectionManager = options.selectionManager || null;

  // Popup individual
  layer.bindPopup(getRoadPopupContent(feature));

  const originalWeight = layer.options.weight;

  layer.on('add', function() {
    if (this._path) {
      this._path.style.cursor = 'pointer';

      // Capa invisible para captar clics con más ancho
      const clickLayer = this._path.cloneNode(true);
      clickLayer.setAttribute('stroke', 'transparent');
      clickLayer.setAttribute('stroke-width', Math.max(15, (originalWeight ?? 2) * 6));
      clickLayer.setAttribute('fill', 'none');
      clickLayer.style.pointerEvents = 'visibleStroke';

      this._path.parentNode.insertBefore(clickLayer, this._path);

      const self = this;
      clickLayer.addEventListener('click', function(e) {
        e.stopPropagation();
        // abrir popup del tramo
        self.openPopup();
        // notificar selección de TODO el camino
        if (selectionManager) selectionManager.selectByFeature(feature, { fitBounds: true, showGroupPopup: true });
        // además, disparar el evento 'click' del layer por si hay otros handlers
        self.fire('click', { originalEvent: e });
      });
      clickLayer.addEventListener('mouseover', (e) => self.fire('mouseover', e));
      clickLayer.addEventListener('mouseout',  (e) => self.fire('mouseout', e));
    }
  });

  // Hover feedback del tramo (no del grupo)
  layer.on({
    mouseover: (e) => {
      const target = e.target;
      target.setStyle({
        weight: (originalWeight ?? 2) + 2,
        opacity: 1,
        color: '#1e40af'
      });
    },
    mouseout: (e) => {
      const target = e.target;
      target.setStyle({
        weight: (originalWeight ?? 2),
        opacity: 0.6,
        color: '#333333'
      });
    }
  });
};
