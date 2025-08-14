import React, { useEffect, useState } from 'react';

/**
 * AdminPanel (compatible con backend dado)
 * - Login: POST /api/admin/login  { password }
 * - Cargar estados: GET /api/admin/zones/states  -> { success, states: { [zone_name]: { state, ... } } }
 * - Update: POST /api/admin/zones/update-state  { zone_name, state }  // state: 'green'|'yellow'|'red'
 * - Reporte (opcional): GET /api/report/generate-pdf
 */
export default function AdminPanel({ onZoneStateChange }) {
  const [isVisible, setIsVisible] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [zoneStates, setZoneStates] = useState({});   // { [zone_name]: 'verde'|'amarillo'|'rojo' }
  const [zones, setZones] = useState([]);             // ['Arevalo','Tupambaé', ...]
  const [selectedZone, setSelectedZone] = useState('');
  const [selectedState, setSelectedState] = useState('verde');

  const BACKEND_URL =
    (typeof window !== 'undefined' && window.BACKEND_URL) ||
    import.meta?.env?.VITE_BACKEND_URL ||
    process?.env?.REACT_APP_BACKEND_URL ||
    'https://cerro-largo-backend.onrender.com';

  const API = (p) => `${String(BACKEND_URL).replace(/\/$/, '')}${p}`;

  const normalizeToEs = (s) => {
    if (!s) return 'sin-estado';
    const v = String(s).toLowerCase();
    const map = { green: 'verde', yellow: 'amarillo', red: 'rojo', verde: 'verde', amarillo: 'amarillo', rojo: 'rojo' };
    return map[v] || 'sin-estado';
  };

  const getStateLabel = (s) => {
    const v = normalizeToEs(s);
    if (v === 'verde') return '🟩 Habilitado';
    if (v === 'amarillo') return '🟨 Alerta';
    if (v === 'rojo') return '🟥 Suspendido';
    return 'Sin estado';
  };

  const fetchJsonStrict = async (url, options={}) => {
    const res = await fetch(url, { credentials: 'include', ...options });
    const ct = res.headers.get('content-type') || '';
    const body = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} @ ${url} :: ${body.slice(0,200)}`);
    if (!ct.includes('application/json')) throw new Error(`No-JSON @ ${url} :: ${body.slice(0,200)}`);
    try { return JSON.parse(body); } catch (e) { throw new Error(`JSON inválido @ ${url} :: ${e.message}`); }
  };

  const loadZones = async () => {
    setLoading(true);
    try {
      const data = await fetchJsonStrict(API('/api/admin/zones/states'));
      if (!data?.success) throw new Error(data?.message || 'Error al obtener estados');
      const statesMap = {};
      const names = [];
      for (const [zoneName, info] of Object.entries(data.states || {})) {
        const es = normalizeToEs(info?.state);
        statesMap[zoneName] = es;
        names.push(zoneName);
      }
      setZoneStates(statesMap);
      setZones(names.sort((a,b)=>a.localeCompare(b)));
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e?.preventDefault?.();
    setLoading(true);
    try {
      await fetchJsonStrict(API('/api/admin/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      setIsAuthenticated(true);  // Will fix below
    } catch (err) {
      alert(err.message);
      return;
    } finally {
      setLoading(false);
      setPassword('');
    }
    // load after login
    try { await loadZones(); } catch (e) { console.warn(e); }
  };

  const handleUpdate = async () => {
    if (!selectedZone) { alert('Selecciona una zona.'); return; }
    setLoading(true);  // Will fix below
    try {
      await fetchJsonStrict(API('/api/admin/zones/update-state'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zone_name: selectedZone, state: normalizeToEs(selectedState) })
      });
      setZoneStates((prev) => ({ ...prev, [selectedZone]: normalizeToEs(selectedState) }));
      if (typeof onZoneStateChange === 'function') onZoneStateChange(selectedZone, normalizeToEs(selectedState));
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const zoneList = (zones && zones.length ? zones : Object.keys(zoneStates || {}));

  return (
    <div className={`admin-panel ${isAuthenticated ? 'auth' : 'anon'} ${isVisible ? 'visible' : ''}`}>
      <button className="admin-toggle" onClick={() => setIsVisible(!isVisible)}>
        {isVisible ? '▼' : '▲'} Admin
      </button>

      {isVisible && !isAuthenticated && (
        <div className="admin-content">
          <h4>Acceso Administrador</h4>
          <form onSubmit={handleLogin}>
            <input
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
            <button type="submit" disabled={loading}>{loading ? '...' : 'Ingresar'}</button>
          </form>
        </div>
      )}

      {isVisible && isAuthenticated && (
        <div className="admin-content">
          <div className="zone-controls">
            <div className="control-group">
              <label>Zona/Municipio</label>
              <select value={selectedZone} onChange={(e) => setSelectedZone(e.target.value)}>
                <option value="">Seleccionar...</option>
                {zoneList.map((z) => (
                  <option key={z} value={z}>{z}</option>
                ))}
              </select>
            </div>

            <div className="control-group">
              <label>Estado</label>
              <select value={selectedState} onChange={(e) => setSelectedState(e.target.value)}>
                <option value="verde">🟩 Habilitado</option>
                <option value="amarillo">🟨 Alerta</option>
                <option value="rojo">🟥 Suspendido</option>
              </select>
            </div>

            <div className="button-group">
              <button onClick={handleUpdate} disabled={loading || !selectedZone}>
                {loading ? '...' : 'Actualizar Estado'}
              </button>
              <button
                onClick={async () => { try { await loadZones(); } catch (e) { alert(e.message); } }}
                disabled={loading}
              >
                {loading ? '...' : '↻ Recargar estados'}
              </button>
            </div>
          </div>

          <div className="current-states">
            <h5>Estados actuales</h5>
            <div className="states-list">
              {Object.entries(zoneStates).map(([zone, st]) => (
                <div key={zone} className="state-item">
                  <span className="zone-name">{zone}</span>
                  <span className="state-indicator">{getStateLabel(st)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
