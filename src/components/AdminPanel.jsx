import React, { useEffect, useMemo, useState } from 'react';

/**
 * AdminPanel (versión completa, ~300 líneas)
 * Compatible con backend provisto:
 *  - POST /api/admin/login          body: { password }
 *  - GET  /api/admin/zones/states   -> { success, states: { [zone_name]: { state, ... } } }
 *  - POST /api/admin/zones/update-state  body: { zone_name, state } // 'green'|'yellow'|'red'
 *  - (Opcional) GET /api/report/generate-pdf
 *
 * Notas:
 *  - Env: VITE_BACKEND_URL (Vite) o REACT_APP_BACKEND_URL (CRA) o window.BACKEND_URL
 *  - credentials:'include' para usar cookie de sesión.
 *  - Valida Content-Type para evitar parsear HTML.
 */

function normalizeEs(s) {
  if (!s) return 'sin-estado';
  const v = String(s).toLowerCase();
  const map = { green: 'verde', yellow: 'amarillo', red: 'rojo', verde: 'verde', amarillo: 'amarillo', rojo: 'rojo' };
  return map[v] || 'sin-estado';
}
function normalizeEn(s) {
  if (!s) return 'red'; // por defecto conservador
  const v = String(s).toLowerCase();
  const map = { verde: 'green', amarillo: 'yellow', rojo: 'red', green: 'green', yellow: 'yellow', red: 'red' };
  return map[v] || 'red';
}
function stateLabelEs(s) {
  const v = normalizeEs(s);
  if (v === 'verde') return '🟩 Habilitado';
  if (v === 'amarillo') return '🟨 Alerta';
  if (v === 'rojo') return '🟥 Suspendido';
  return 'Sin estado';
}
function stateColor(s) {
  const v = normalizeEs(s);
  if (v === 'verde') return '#22c55e';
  if (v === 'amarillo') return '#eab308';
  if (v === 'rojo') return '#ef4444';
  return '#6b7280';
}

async function fetchJsonStrict(url, options = {}) {
  const res = await fetch(url, { credentials: 'include', ...options });
  const ct = res.headers.get('content-type') || '';
  const body = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} @ ${url} :: ${body.slice(0, 200)}`);
  if (!ct.includes('application/json')) throw new Error(`No-JSON @ ${url} :: ${body.slice(0, 200)}`);
  try {
    return JSON.parse(body);
  } catch (e) {
    throw new Error(`JSON inválido @ ${url} :: ${e.message}`);
  }
}

export default function AdminPanel({ onZoneStateChange }) {
  // UI
  const [isVisible, setIsVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  // Auth
  const [isAuthed, setIsAuthed] = useState(false);
  const [password, setPassword] = useState('');

  // Data
  const [zones, setZones] = useState([]);           // ['Arévalo', ...]
  const [zoneStates, setZoneStates] = useState({});  // { 'Arévalo': 'green'|'yellow'|'red' }

  // Selection
  const [selectedZone, setSelectedZone] = useState('');
  const [selectedState, setSelectedState] = useState('verde');

  const BACKEND_URL =
    (typeof window !== 'undefined' && window.BACKEND_URL) ||
    (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env.VITE_REACT_APP_BACKEND_URL || import.meta.env.VITE_BACKEND_URL)) ||
    (typeof process !== 'undefined' && process.env && (process.env.REACT_APP_BACKEND_URL)) ||
    'https://cerro-largo-backend.onrender.com';

  const API = (p) => `${String(BACKEND_URL || '').replace(/\/$/, '')}${p}`;

  // Verifica sesión SIN asumir autenticación por leer /zones/states
  async function checkAuth() {
    try {
      const d = await fetchJsonStrict(API('/api/admin/check-auth'));
      if (d?.authenticated === true || d?.success === true) {
        setIsAuthed(true);
      }
    } catch (_) {
      // si no existe el endpoint, se mantiene no autenticado
    }
  }


  // Intenta detectar si ya hay sesión válida: si /zones/states devuelve JSON, asumimos autenticado.
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!BACKEND_URL) return;
      try {
        setLoading(true);
        const data = await fetchJsonStrict(API('/api/admin/zones/states'));
        if (!mounted) return;
        if (data?.success) {
          setIsAuthed(true);
          applyStatesPayload(data.states || {});
        }
      } catch (e) {
        // No logueado o CORS; no molestamos al usuario.
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [BACKEND_URL]);

  function applyStatesPayload(statesObj) {
    const names = [];
    const map = {};
    for (const [zoneName, info] of Object.entries(statesObj || {})) {
      const st = normalizeEn(info?.state);
      map[zoneName] = st;
      names.push(zoneName);
    }
    names.sort((a, b) => a.localeCompare(b));
    setZones(names);
    setZoneStates(map);
  }

  async function handleLogin(e) {
    e?.preventDefault?.();
    if (!BACKEND_URL) { alert('Configura BACKEND_URL.'); return; }
    setLoading(true); setMsg('');
    try {
      const res = await fetchJsonStrict(API('/api/admin/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      if (res?.success === false) throw new Error(res?.message || 'Login falló');
      setIsAuthed(true);
      setPassword('');
      await refreshStates();
      setMsg('Autenticado.');
    } catch (e) {
      setMsg(e.message);
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function refreshStates() {
    if (!BACKEND_URL) { alert('Configura BACKEND_URL.'); return; }
    setLoading(true); setMsg('');
    try {
      const data = await fetchJsonStrict(API('/api/admin/zones/states'));
      if (!data?.success) throw new Error(data?.message || 'Error al obtener estados');
      applyStatesPayload(data.states || {});
      setMsg('Estados actualizados.');
    } catch (e) {
      setMsg(e.message);
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateOne() {
    if (!isAuthed) { alert('Inicia sesión para actualizar estados.'); return; }
    if (!selectedZone) { alert('Selecciona una zona.'); return; }
    if (!BACKEND_URL) { alert('Configura BACKEND_URL.'); return; }
    setLoading(true); setMsg('');
    try {
      const body = { zone_name: selectedZone, state: normalizeEn(selectedState) };
      const res = await fetchJsonStrict(API('/api/admin/zones/update-state'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (res?.success === false) throw new Error(res?.message || 'Actualización fallida');
      setZoneStates((prev) => ({ ...prev, [selectedZone]: normalizeEn(selectedState) }));
      if (typeof onZoneStateChange === 'function') onZoneStateChange(selectedZone, normalizeEn(selectedState));
      setMsg('Estado actualizado.');
    } catch (e) {
      setMsg(e.message);
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDownloadReport() {
    if (!BACKEND_URL) { alert('Configura BACKEND_URL.'); return; }
    setLoading(true); setMsg('');
    try {
      const url = API('/api/report/generate-pdf');
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('application/pdf')) {
        const text = await res.text();
        throw new Error(`No-PDF: ${text.slice(0, 200)}`);
      }
      const blob = await res.blob();
      const objURL = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objURL;
      a.download = `reporte_camineria_${new Date().toISOString().slice(0,10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objURL);
      setMsg('Reporte descargado.');
    } catch (e) {
      setMsg(e.message);
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  const zoneList = useMemo(() => {
    if (zones && zones.length) return zones;
    return Object.keys(zoneStates || {}).sort((a,b)=>a.localeCompare(b));
  }, [zones, zoneStates]);

  return (
    <div className={`admin-panel ${isVisible ? 'visible' : ''}`}>
      <button className="admin-toggle" onClick={() => setIsVisible((v) => !v)}>
        {isVisible ? '▼' : '▲'} Admin
      </button>

      {isVisible && !isAuthed && (
        <div className="admin-content">
          <h4>Acceso Administrador</h4>
          <form onSubmit={handleLogin} className="admin-login-form">
            <input
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
            <button type="submit" disabled={loading || !password}>
              {loading ? 'Verificando…' : 'Ingresar'}
            </button>
          </form>
          {msg && <div className="admin-msg">{msg}</div>}
        </div>
      )}

      {isVisible && isAuthed && (
        <div className="admin-content">
          <div className="admin-header">
            <h4>Panel de Control</h4>
            <div className="admin-actions">
              <button onClick={refreshStates} disabled={loading}>{loading ? '...' : '↻ Recargar'}</button>
              <button onClick={handleDownloadReport} disabled={loading}>📄 Reporte</button>
            </div>
          </div>

          <div className="zone-controls">
            <div className="control-group">
              <label>Zona/Municipio</label>
              <select value={selectedZone} onChange={(e) => setSelectedZone(e.target.value)}>
                <option value="">Seleccionar…</option>
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
              <button onClick={handleUpdateOne} disabled={loading || !selectedZone}>
                {loading ? 'Actualizando…' : 'Actualizar Estado'}
              </button>
            </div>
          </div>

          <div className="current-states">
            <h5>Estados actuales</h5>
            <div className="states-list">
              {zoneList.map((z) => (
                <div key={z} className="state-item">
                  <span className="zone-name">{z}</span>
                  <span className="state-indicator" style={{ color: stateColor(zoneStates[z]) }}>
                    {stateLabelEs(zoneStates[z])}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {msg && <div className="admin-msg">{msg}</div>}
        </div>
      )}
    </div>
  );
}
