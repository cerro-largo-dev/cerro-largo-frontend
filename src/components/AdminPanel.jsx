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
  const BACKEND_URL =
    (typeof window !== 'undefined' && window.BACKEND_URL) ||
    (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env.VITE_REACT_APP_BACKEND_URL || import.meta.env.VITE_BACKEND_URL)) ||
    (typeof process !== 'undefined' && process.env && (process.env.REACT_APP_BACKEND_URL || process.env.VITE_BACKEND_URL)) ||
    'https://cerro-largo-backend.onrender.com';

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

    // Normalizadores de estado (aceptan string o {state})
  const normalizeToEs = (state) => {
    const raw = typeof state === 'string' ? state : (state && state.state);
    const s = String(raw || '').toLowerCase();
    const map = { green:'verde', yellow:'amarillo', red:'rojo', verde:'verde', amarillo:'amarillo', rojo:'rojo' };
    return map[s] || 'sin-estado';
  };

  const normalizeToEn = (state) => {
    const raw = typeof state === 'string' ? state : (state && state.state);
    const s = String(raw || '').toLowerCase();
    const map = { verde:'green', amarillo:'yellow', rojo:'red', green:'green', yellow:'yellow', red:'red' };
    return map[s] || 'red';
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
        if (data && data.authenticated === true) {
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
      `${BACKEND_URL}/api/admin/zones/states`,
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

        if (data && typeof data === 'object' && data.states && typeof data.states === 'object') {
          statesMap = data.states;
          zonesArr = Object.keys(statesMap);
        } else if (Array.isArray(data)) {
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

  const handleLogin = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setIsLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        setIsAuthenticated(true);
        setPassword('');
        await loadZones();
        alert('Autenticación exitosa');
      } else {
        let msg = 'Contraseña incorrecta';
        try {
          const err = await response.json();
          if (err && err.message) msg = err.message;
        } catch (_) {}
        alert(msg);
      }
    } catch (error) {
      console.error('Error en login:', error);
      alert('Error de conexión');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(`${BACKEND_URL}/api/admin/logout`, {
        method: 'POST',
        credentials: 'include',
      });
      setIsAuthenticated(false);
      setIsVisible(false);
    } catch (error) {
      console.error('Error en logout:', error);
    }
  };

  const handleUpdateZoneState = async () => {
    if (!selectedZone || !selectedState) {
      alert('Selecciona una zona y un estado');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/admin/zones/update-state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          zone_name: selectedZone,
          state: normalizeToEn(selectedState),
        }),
      });

      if (response.ok) {
        setZoneStates((prev) => ({ ...prev, [selectedZone]: normalizeToEn(selectedState) }));
        if (typeof onZoneStateChange === 'function') {
          onZoneStateChange(selectedZone, normalizeToEn(selectedState));
        }
        alert('Estado actualizado correctamente');
        setSelectedZone('');
        setSelectedState('verde');
        await loadZones();
      } else {
        let msg = 'Error al actualizar estado';
        try {
          const err = await response.json();
          if (err && err.message) msg = err.message;
        } catch (_) {}
        alert(msg);
      }
    } catch (error) {
      console.error('Error actualizando estado:', error);
      alert('Error de conexión');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadReport = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/report/generate-pdf`, {
        method: 'GET',
        credentials: 'include',
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `reporte_camineria_cerro_largo_${new Date().toISOString().slice(0, 10)}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        alert('Reporte descargado correctamente');
      } else {
        let msg = 'Error al generar reporte';
        try {
          const err = await response.json();
          if (err && err.message) msg = err.message;
        } catch (_) {}
        alert(msg);
      }
    } catch (error) {
      console.error('Error descargando reporte:', error);
      alert('Error de conexión al descargar reporte');
    } finally {
      setIsLoading(false);
    }
  };

  const zoneNameOf = (z) => (typeof z === 'string' ? z : (z && (z.name || z.zone)) || '');

  if (!isAuthenticated) {
    return (
      <div className={`admin-panel ${isVisible ? 'visible' : ''}`}>
        <button className="admin-toggle" onClick={() => setIsVisible(!isVisible)}>
          {isVisible ? '▼' : '▲'} Admin
        </button>

        {isVisible && (
          <div className="admin-content">
            <h4>Acceso Administrador</h4>
            <form onSubmit={handleLogin}>
              <input
                type="password"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
              <button type="submit" disabled={isLoading}>
                {isLoading ? 'Verificando...' : 'Ingresar'}
              </button>
            </form>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`admin-panel authenticated ${isVisible ? 'visible' : ''}`}>
      <button className="admin-toggle" onClick={() => setIsVisible(!isVisible)}>
        {isVisible ? '▼' : '▲'} Panel Admin
      </button>

      {isVisible && (
        <div className="admin-content">
          <div className="admin-header">
            <h4>Panel de Control</h4>
            <button onClick={handleLogout} className="logout-btn">
              Cerrar Sesión
            </button>
          </div>

          <div className="zone-controls">
            <div className="control-group">
              <label>Zona/Municipio:</label>
              <select value={selectedZone} onChange={(e) => setSelectedZone(e.target.value)}>
                <option value="">Seleccionar zona...</option>
                {(zones && zones.length > 0 ? zones : zonesProp).map((z) => {
                  const name = zoneNameOf(z);
                  return (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="control-group">
              <label>Estado:</label>
              <select value={selectedState} onChange={(e) => setSelectedState(e.target.value)}>
                <option value="verde">🟩 Habilitado</option>
                <option value="amarillo">🟨 Alerta</option>
                <option value="rojo">🟥 Suspendido</option>
              </select>
            </div>

            <div className="button-group">
              <button onClick={handleUpdateZoneState} disabled={isLoading || !selectedZone} className="update-btn">
                {isLoading ? 'Actualizando...' : 'Actualizar Estado'}
              </button>

              <button onClick={handleDownloadReport} disabled={isLoading} className="report-btn">
                {isLoading ? 'Generando...' : '📄 Descargar Reporte'}
              </button>
            </div>
          </div>

          <div className="current-states">
            <h5>Estados Actuales:</h5>
            <div className="states-list">
              {Object.entries(zoneStates).map(([zone, state]) => (
                <div key={zone} className="state-item">
                  <span className="zone-name">{zone}</span>
                  <span className="state-indicator" style={{ color: getStateColor(state) }}>
                    {getStateLabel(state)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
