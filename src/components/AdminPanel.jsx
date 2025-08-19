import React, { useState, useEffect, useMemo } from 'react';

/**
 * AdminPanel con:
 * - Login (admin o editor por zona)
 * - Filtro de zonas según allowed_zones
 * - Update de estado con credenciales (CORS + cookies)
 * - Descarga de reporte en /api/report/download
 * - Editor de Banner (debajo de “Estados actuales”) con POST /api/admin/banner
 * - Emite CustomEvents para refrescar mapa y banner sin recargar
 *
 * Estructura respetada: toggle, login, selects, botones y lista de estados.
 */
const AdminPanel = ({
  onZoneStateChange,
  zoneStates: zoneStatesProp = {},
  zones: zonesProp = [],
}) => {
  // UI / sesión
  const [isVisible, setIsVisible] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(null);            // 'admin' | 'editor'
  const [allowedZones, setAllowedZones] = useState('*'); // '*' | [] | ['AREVALO', ...]

  // Zonas y estados
  const [zones, setZones] = useState(zonesProp);
  const [zoneStates, setZoneStates] = useState(zoneStatesProp);
  const [selectedZone, setSelectedZone] = useState('');
  const [selectedState, setSelectedState] = useState('verde');
  const [isLoading, setIsLoading] = useState(false);

  // URL del backend (tu patrón)
  const BACKEND_URL =
    (typeof window !== 'undefined' && window.BACKEND_URL) ||
    (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env.VITE_REACT_APP_BACKEND_URL || import.meta.env.VITE_BACKEND_URL)) ||
    (typeof process !== 'undefined' && process.env && (process.env.REACT_APP_BACKEND_URL || process.env.VITE_BACKEND_URL)) ||
    'https://cerro-largo-backend.onrender.com';

  const API = useMemo(() => {
    const base = String(BACKEND_URL || '').replace(/\/$/, '');
    return (p) => base + p;
  }, [BACKEND_URL]);

  // Orden fijo solicitado
  const DESIRED_ZONE_ORDER = [
    'ACEGUÁ', 'FRAILE MUERTO', 'RÍO BRANCO', 'TUPAMBAÉ', 'LAS CAÑAS', 'ISIDORO NOBLÍA',
    'CERRO DE LAS CUENTAS', 'ARÉVALO', 'BAÑADO DE MEDINA', 'TRES ISLAS', 'LAGUNA MERÍN',
    'CENTURIÓN', 'RAMÓN TRIGO', 'ARBOLITO', 'QUEBRACHO', 'PLÁCIDO ROSAS',
    'Melo (GBA)', 'Melo (GBB)', 'Melo (GBC)', 'Melo (GCB)', 'Melo (GEB)'
  ];

  // Helpers de estado
  const normalizeToEs = (state) => {
    const raw = typeof state === 'string' ? state : (state && state.state);
    const s = String(raw || '').toLowerCase();
    const map = { green: 'verde', yellow: 'amarillo', red: 'rojo', verde: 'verde', amarillo: 'amarillo', rojo: 'rojo' };
    return map[s] || 'sin-estado';
  };

  const normalizeToEn = (state) => {
    const raw = typeof state === 'string' ? state : (state && state.state);
    const s = String(raw || '').toLowerCase();
    const map = { verde: 'green', amarillo: 'yellow', rojo: 'red', green: 'green', yellow: 'yellow', red: 'red' };
    return map[s] || 'red';
  };

  const getStateColor = (state) => {
    switch (normalizeToEs(state)) {
      case 'verde': return '#22c55e';
      case 'amarillo': return '#eab308';
      case 'rojo': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getStateLabel = (state) => {
    switch (normalizeToEs(state)) {
      case 'verde': return '🟩 Habilitado';
      case 'amarillo': return '🟨 Alerta';
      case 'rojo': return '🟥 Suspendido';
      default: return 'Sin estado';
    }
  };

  // Canonizador (mayúsculas, sin acentos)
  const canon = (s) => (s || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .trim();

  // Fetch JSON robusto (evita el error "<!doctype ... no es JSON")
  const fetchJsonSafe = async (url, options = {}) => {
    const res = await fetch(url, { credentials: 'include', ...options });
    const ct = res.headers.get('content-type') || '';
    const text = await res.text();
    if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + res.statusText + ': ' + text.slice(0, 200));
    if (ct.indexOf('application/json') === -1) throw new Error('No-JSON: ' + text.slice(0, 200));
    try { return JSON.parse(text); } catch { return {}; }
  };

  // Check de sesión al montar
  useEffect(() => { checkAuthentication(); /* eslint-disable-next-line */ }, []);

  const checkAuthentication = async () => {
    try {
      const data = await fetchJsonSafe(API('/api/admin/check-auth'));
      if (data && data.authenticated === true) {
        setIsAuthenticated(true);
        setRole(data.role || 'admin');
        setAllowedZones(data.allowed_zones ?? (data.role === 'admin' ? '*' : []));
        await loadZones(data.allowed_zones);
      }
    } catch (err) {
      // sin sesión, queda en login
    }
  };

  const loadZones = async (allowed = allowedZones) => {
    const candidates = [
      API('/api/admin/zones/states'),
      API('/api/admin/zones'),
      API('/api/admin/zone-states'),
      API('/api/admin/list-zones'),
      API('/api/admin/zonas'),
      API('/api/zones'),
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
        }

        // Orden fijo solicitado
        zonesArr = DESIRED_ZONE_ORDER.slice();

        // Filtro por rol editor
        if (allowed && allowed !== '*' && Array.isArray(allowed) && allowed.length) {
          const setAllowed = new Set(allowed.map(canon));
          zonesArr = (zonesArr || []).filter((n) => setAllowed.has(canon(typeof n === 'string' ? n : (n && (n.name || n.zone)) || '')));
        }

        setZones(Array.isArray(zonesArr) ? zonesArr : []);

        const mapping = {};
        (zonesArr || []).forEach((z) => {
          if (typeof z === 'string') {
            const st = statesMap && statesMap[z] ? statesMap[z] : undefined;
            mapping[z] = normalizeToEs(st);
          } else if (z && (z.name || z.zone)) {
            const name = z.name || z.zone;
            mapping[name] = normalizeToEs(z.state);
          }
        });

        Object.entries(statesMap).forEach(([name, st]) => {
          if ((zonesArr || []).includes(name)) {
            if (!allowed || allowed === '*' || (Array.isArray(allowed) && allowed.map(canon).includes(canon(name)))) {
              mapping[name] = normalizeToEs(st);
            }
          }
        });

        setZoneStates((prev) => ({ ...prev, ...mapping }));
        return; // éxito
      } catch (err) {
        lastErr = err;
        continue;
      }
    }
    alert('No se pudieron cargar zonas. Ver consola. ' + (lastErr ? lastErr.message : ''));
  };

  const handleLogin = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setIsLoading(true);
    try {
      const d = await fetchJsonSafe(API('/api/admin/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password }),
      });
      if (d && d.success) {
        setIsAuthenticated(true);
        setPassword('');
        setRole(d.role || 'admin');
        setAllowedZones(d.allowed_zones ?? (d.role === 'admin' ? '*' : []));
        await loadZones(d.allowed_zones);
        alert(d.message || 'Autenticación exitosa');
      } else {
        alert((d && d.message) || 'Contraseña incorrecta');
      }
    } catch (err) {
      alert(err.message || 'Error de conexión');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(API('/api/admin/logout'), { method: 'POST', credentials: 'include' });
    } catch {}
    setIsAuthenticated(false);
    setIsVisible(false);
    setRole(null);
    setAllowedZones('*');
  };

  const handleUpdateZoneState = async () => {
    if (!selectedZone || !selectedState) {
      alert('Selecciona una zona y un estado');
      return;
    }
    // Bloqueo UI si editor fuera de zona permitida
    if (allowedZones !== '*' && Array.isArray(allowedZones) && allowedZones.length) {
      const ok = allowedZones.map(canon).includes(canon(selectedZone));
      if (!ok) { alert('No estás autorizado para esta zona'); return; }
    }

    setIsLoading(true);
    try {
      const d = await fetchJsonSafe(API('/api/admin/zones/update-state'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          zone_name: selectedZone,
          state: normalizeToEn(selectedState),
        }),
      });
      if (!d || d.success === false) throw new Error((d && d.message) || 'Error al actualizar');

      // 1) Estado local (para la lista del panel)
      const enState = normalizeToEn(selectedState);
      setZoneStates((prev) => ({ ...prev, [selectedZone]: enState }));

      // 2) Notifica al mapa via callback de App (si existe)
      if (typeof onZoneStateChange === 'function') {
        try { onZoneStateChange(selectedZone, enState); } catch {}
      }

      // 3) Evento global opcional
      try {
        window.dispatchEvent(new CustomEvent('zoneStateUpdated', { detail: { zone_name: selectedZone, state: enState } }));
      } catch {}

      alert('Estado actualizado correctamente');
      setSelectedZone('');
      setSelectedState('verde');
    } catch (err) {
      alert(err.message || 'Error de conexión');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadReport = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(API('/api/report/download'), { method: 'GET', credentials: 'include' });
      if (!res.ok) {
        let msg = 'Error al generar reporte';
        try { const e = await res.json(); if (e && e.message) msg = e.message; } catch {}
        throw new Error(msg);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = 'reporte_camineria_cerro_largo_' + new Date().toISOString().slice(0, 10) + '.pdf';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      alert('Reporte descargado correctamente');
    } catch (err) {
      alert(err.message || 'Error de conexión al descargar reporte');
    } finally {
      setIsLoading(false);
    }
  };

  const zoneNameOf = (z) => (typeof z === 'string' ? z : (z && (z.name || z.zone)) || '');

  // -------- Banner Editor (debajo de “Estados actuales”) --------
  const BannerEditor = ({ BACKEND_URL }) => {
    const [text, setText] = useState('');
    const [enabled, setEnabled] = useState(false);
    const [saving, setSaving] = useState(false);

    const api = useMemo(() => {
      const base = String(BACKEND_URL || '').replace(/\/$/, '');
      return (p) => base + p;
    }, [BACKEND_URL]);

    useEffect(() => {
      (async () => {
        try {
          const res = await fetch(api('/api/admin/banner'), { credentials: 'include' });
          const d = await res.json().catch(() => ({}));
          if (res.ok && d) {
            setText(String(d.text || ''));
            setEnabled(Boolean(d.enabled && String(d.text || '').trim().length > 0));
          }
        } catch {}
      })();
    }, [api]);

    const save = async () => {
      setSaving(true);
      try {
        const body = {
          text: String(text || ''),
          enabled: Boolean(enabled && String(text || '').trim().length > 0),
          variant: 'info',
        };
        const res = await fetch(api('/api/admin/banner'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(body),
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok || (d && d.success === false)) throw new Error((d && d.message) || 'Error al guardar');
        // Notificar al SiteBanner en vivo
        try { window.dispatchEvent(new CustomEvent('bannerUpdated', { detail: d.banner || body })); } catch {}
        alert('Banner guardado');
      } catch (e) {
        alert(e.message || 'Error al guardar');
      } finally {
        setSaving(false);
      }
    };

    return (
      <div className="banner-editor" style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #e5e7eb' }}>
        <h5 style={{ marginBottom: 8 }}>Mensaje público (AVISO)</h5>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={1}
            placeholder="Escribe el mensaje de aviso..."
            style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Mostrar Aviso
          </label>
          <div>
            <button onClick={save} disabled={saving} className="update-btn">
              {saving ? 'Guardando…' : 'Guardar Aviso'}
            </button>
          </div>
        </div>
      </div>
    );
  };
  // ---------------------------------------------------------------

  if (!isAuthenticated) {
    return (
      <div className={`admin-panel ${isVisible ? 'visible' : ''}`}>
        <button className="admin-toggle" onClick={() => setIsVisible(!isVisible)}>
          {isVisible ? '▼' : '▲'} Admin
        </button>

        {isVisible && (
          <div className="admin-content">
            <h4>Acceso Administrador/Editor</h4>
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
        {isVisible ? '▼' : '▲'} Panel {role === 'editor' ? 'Editor' : 'Admin'}
      </button>

      {isVisible && (
        <div className="admin-content">
          <div className="admin-header">
            <h4>Panel de Control</h4>
            <button onClick={handleLogout} className="logout-btn">Cerrar Sesión</button>
          </div>

          <div className="zone-controls">
            <div className="control-group">
              <label>Zona/Municipio:</label>
              <select value={selectedZone} onChange={(e) => setSelectedZone(e.target.value)}>
                <option value="">Seleccionar zona...</option>
                {(zones && zones.length > 0 ? zones : zonesProp).map((z) => {
                  const name = zoneNameOf(z);
                  if (allowedZones !== '*' && Array.isArray(allowedZones) && allowedZones.length) {
                    if (!allowedZones.map(canon).includes(canon(name))) return null;
                  }
                  return <option key={name} value={name}>{name}</option>;
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
              {Object.entries(zoneStates).map(([zone, state]) => {
                if (allowedZones !== '*' && Array.isArray(allowedZones) && allowedZones.length) {
                  if (!allowedZones.map(canon).includes(canon(zone))) return null;
                }
                return (
                  <div key={zone} className="state-item">
                    <span className="zone-name">{zone}</span>
                    <span className="state-indicator" style={{ color: getStateColor(state) }}>
                      {getStateLabel(state)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Editor de banner (debajo de estados) */}
          <BannerEditor BACKEND_URL={BACKEND_URL} />
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
