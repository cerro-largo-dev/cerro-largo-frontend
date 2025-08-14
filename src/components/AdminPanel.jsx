import React, { useState, useEffect } from 'react';

/**
 * AdminPanel_3 integrado con backend y login del AdminPanel4.
 * - Usa BACKEND_URL para todas las llamadas (login, zonas, update-state, logout, reporte).
 * - Carga de zonas desde `${BACKEND_URL}/api/admin/zones` al autenticar.
 * - Update state a `${BACKEND_URL}/api/admin/update-state` (compatibilidad con AdminPanel4).
 * - Descarga de reporte desde `${BACKEND_URL}/api/report/generate-pdf`.
 * - Soporta estados "verde/amarillo/rojo" y también "green/yellow/red" de forma transparente.
 * - Si se pasan props zones/zoneStates, las usa como iniciales; luego sincroniza con backend.
 */
const AdminPanel = ({ onZoneStateChange, zoneStates: zoneStatesProp = {}, zones: zonesProp = [] }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const [selectedZone, setSelectedZone] = useState('');
  const [selectedState, setSelectedState] = useState('verde');
  const [isLoading, setIsLoading] = useState(false);
  const [zones, setZones] = useState(zonesProp);
  const [zoneStates, setZoneStates] = useState(zoneStatesProp);

  // Permite sobreescribir por env o window. Fallback al Render del proyecto
  $1
  // Helper: intenta parsear JSON; si viene HTML (<!doctype ...>) lanza error con snippet legible.
  const fetchJsonSafe = async (url, options = {}) => {
    const res = await fetch(url, { credentials: 'include', ...options });
    const ct = res.headers.get('content-type') || '';
    if (!res.ok) {
      let body = '';
      try { body = await res.text(); } catch (_) {}
      throw new Error(`HTTP ${res.status} ${res.statusText} en ${url} — ${body.slice(0, 200)}`);
    }
    if (ct.includes('application/json')) {
      return res.json();
    }
    const text = await res.text();
    throw new Error(`Respuesta no JSON desde ${url}: ${text.slice(0, 200)}`);
  };

  useEffect(() => {
    checkAuthentication();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const normalizeToEs = (state) => {
    if (!state) return 'sin-estado';
    const s = String(state).toLowerCase();
    const map = {
      green: 'verde',
      yellow: 'amarillo',
      red: 'rojo',
      verde: 'verde',
      amarillo: 'amarillo',
      rojo: 'rojo',
    };
    return map[s] || 'sin-estado';
  };

  const getStateColor = (state) => {
    const s = normalizeToEs(state);
    switch (s) {
      case 'verde':
        return '#22c55e';
      case 'amarillo':
        return '#eab308';
      case 'rojo':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const getStateLabel = (state) => {
    const s = normalizeToEs(state);
    switch (s) {
      case 'verde':
        return '🟩 Habilitado';
      case 'amarillo':
        return '🟨 Alerta';
      case 'rojo':
        return '🟥 Suspendido';
      default:
        return 'Sin estado';
    }
  };

  const checkAuthentication = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/admin/check-auth`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        if (data.authenticated === true || data.success === true) {
          setIsAuthenticated(true);
          await loadZones();
        }
      }
    } catch (error) {
      // Silencioso
      console.error('Error verificando autenticación:', error);
    }
  };

  const loadZones = async () => {
    const candidates = [
      `${BACKEND_URL}/api/admin/zones`,
      `${BACKEND_URL}/api/admin/zone-states`,
      `${BACKEND_URL}/api/admin/list-zones`,
      `${BACKEND_URL}/api/admin/zonas`,
      `${BACKEND_URL}/api/zones`,
    ];

    let lastErr = null;

    for (const url of candidates) {
      try {
        const data = await fetchJsonSafe(url);

        let zonesArr = [];
        let statesMap = {};

        if (Array.isArray(data)) {
          zonesArr = data;
        } else if (Array.isArray(data?.zones)) {
          zonesArr = data.zones;
          statesMap = data.states || {};
        } else if (Array.isArray(data?.data)) {
          zonesArr = data.data;
        } else if (data && typeof data === 'object') {
          const keys = Object.keys(data);
          const looksLikeMap = keys.length > 0 && keys.every((k) => typeof data[k] === 'string' || typeof data[k] === 'object');
          if (looksLikeMap && !('zones' in data)) {
            statesMap = data;
            zonesArr = keys;
          }
        }

        setZones(Array.isArray(zonesArr) ? zonesArr : []);

        const mapping = {};
        (zonesArr || []).forEach((z) => {
          if (typeof z === 'string') {
            mapping[z] = mapping[z] || 'verde';
          } else if (z && (z.name || z.zone)) {
            const name = z.name || z.zone;
            mapping[name] = normalizeToEs(z.state);
          }
        });

        Object.entries(statesMap).forEach(([name, st]) => {
          mapping[name] = normalizeToEs(st);
        });

        setZoneStates((prev) => ({ ...prev, ...mapping }));
        console.info('Zonas cargadas desde', url, { zonas: zonesArr, estados: mapping });
        return; // éxito
      } catch (err) {
        lastErr = err;
        console.warn('Fallo al cargar zonas desde', url, err);
        continue;
      }
    }

    alert(`No se pudieron cargar zonas. Ver consola. ${lastErr ? lastErr.message : ''}`);
  };

export default AdminPanel;
