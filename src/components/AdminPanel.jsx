import React, { useEffect, useMemo, useState } from "react";

// Ajusta este fallback si no usas Vite:
const BACKEND_URL =
  (typeof import.meta !== "undefined" &&
    import.meta?.env?.VITE_BACKEND_URL) ||
  "https://cerro-largo-backend.onrender.com";

// Endpoints posibles para DB check (ajusta si usas otro)
const DB_CHECK_PATHS = ["/api/admin/db-check", "/api/admin/db_check"];

// Util para auth opcional (si guardas token tras /api/admin/login)
function authHeader() {
  const token =
    localStorage.getItem("adminToken") ||
    localStorage.getItem("token") ||
    "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...authHeader(),
      ...(options.headers || {}),
    },
    ...options,
  });
  // Intento parsear JSON incluso en 4xx/5xx
  let data = null;
  try {
    data = await res.json();
  } catch (_) {
    // ignoro si no es JSON
  }
  if (!res.ok) {
    const msg = data?.error || data?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

export default function AdminPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [dbOk, setDbOk] = useState(null); // null = sin chequear, true/false
  const [dbMsg, setDbMsg] = useState("");
  const [zonesRaw, setZonesRaw] = useState([]);
  const [zoneStates, setZoneStates] = useState({});
  const [applyAllValue, setApplyAllValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const stateOptions = ["OK", "PRECAUCIÓN", "CERRADA"];

  const getZoneId = (z) => {
    if (z == null) return "";
    if (typeof z === "string" || typeof z === "number") return String(z);
    return (
      z.id ??
      z._id ??
      z.code ??
      z.codigo ??
      z.name ??
      z.nombre ??
      ""
    ).toString();
  };

  const getZoneLabel = (z) => {
    if (z == null) return "Zona";
    if (typeof z === "string" || typeof z === "number") return String(z);
    return (
      z.name ??
      z.nombre ??
      z.label ??
      z.codigo ??
      z.code ??
      z.id ??
      z._id ??
      "Zona"
    ).toString();
  };

  const getZoneStateFromObj = (z) => {
    if (!z || typeof z !== "object") return "";
    // intenta campos comunes
    return (
      z.state ??
      z.status ??
      z.estado ??
      z.situacion ??
      ""
    );
  };

  const zones = useMemo(() => zonesRaw || [], [zonesRaw]);

  const rebuildZoneStatesFromZones = (items) => {
    const next = {};
    for (const z of items) {
      const id = getZoneId(z);
      if (id) next[id] = getZoneStateFromObj(z) || "";
    }
    setZoneStates(next);
  };

  const dbCheck = async () => {
    // Prueba múltiples rutas hasta que una responda OK
    for (const path of DB_CHECK_PATHS) {
      try {
        const data = await fetchJson(`${BACKEND_URL}${path}`);
        // Si tu endpoint devuelve otra forma, ajusta acá:
        const ok =
          data?.ok === true ||
          data?.status === "ok" ||
          data?.db === "ok" ||
          data?.healthy === true;
        const msg =
          data?.message ||
          data?.msg ||
          (ok ? "DB OK" : "DB no OK");
        setDbOk(!!ok);
        setDbMsg(msg);
        return !!ok;
      } catch (e) {
        // intenta siguiente path
      }
    }
    setDbOk(false);
    setDbMsg("DB check falló");
    return false;
  };

  const loadZones = async () => {
    const data = await fetchJson(`${BACKEND_URL}/api/admin/zones`);
    // data puede ser { zones: [...] } o directamente [...]
    const items = Array.isArray(data) ? data : data?.zones || [];
    setZonesRaw(items);
    rebuildZoneStatesFromZones(items);
  };

  const refreshAll = async () => {
    setError("");
    setLoading(true);
    try {
      const ok = await dbCheck();
      if (ok) {
        await loadZones();
      }
    } catch (e) {
      setError(e.message || "Error al cargar");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Carga inicial al montar el componente
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApplyAll = () => {
    if (!applyAllValue || !zones.length) return;
    setZoneStates((prev) => {
      const next = { ...prev };
      for (const z of zones) {
        const id = getZoneId(z);
        if (id) next[id] = applyAllValue;
      }
      return next;
    });
  };

  const handlePerZoneChange = (zoneId, newState) => {
    setZoneStates((prev) => ({ ...prev, [zoneId]: newState }));
  };

  // ——— UI ———
  const styles = {
    toggle: {
      position: "fixed",
      left: 16,
      bottom: 16,
      zIndex: 9999,
      padding: "10px 14px",
      borderRadius: 10,
      border: "1px solid #ddd",
      background: "#fff",
      cursor: "pointer",
      boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
      fontWeight: 600,
    },
    panel: {
      position: "fixed",
      left: 16,
      bottom: 72,
      zIndex: 9999,
      width: 380,
      maxWidth: "calc(100vw - 32px)",
      maxHeight: "70vh",
      background: "#fff",
      border: "1px solid #ddd",
      borderRadius: 12,
      boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
    },
    header: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "10px 12px",
      borderBottom: "1px solid #eee",
      background: "#fafafa",
      fontWeight: 700,
    },
    badge: (ok) => ({
      padding: "2px 8px",
      borderRadius: 999,
      fontSize: 12,
      background: ok ? "#dcfce7" : "#fee2e2",
      border: `1px solid ${ok ? "#16a34a" : "#ef4444"}`,
      color: ok ? "#166534" : "#991b1b",
    }),
    body: { padding: 12, overflow: "auto" },
    controls: {
      display: "flex",
      gap: 8,
      marginBottom: 10,
      alignItems: "center",
      flexWrap: "wrap",
    },
    select: {
      width: "100%",
      padding: "6px 8px",
      borderRadius: 8,
      border: "1px solid #ddd",
      background: "#fff",
    },
    row: {
      display: "grid",
      gridTemplateColumns: "1fr 150px",
      gap: 8,
      alignItems: "center",
      padding: "6px 0",
      borderBottom: "1px dashed #f0f0f0",
    },
    btn: {
      padding: "8px 10px",
      borderRadius: 8,
      border: "1px solid #ddd",
      background: "#f7f7f7",
      cursor: "pointer",
      fontWeight: 600,
    },
    btnPrimary: {
      background: "#0ea5e9",
      border: "1px solid #0ea5e9",
      color: "#fff",
    },
    footer: {
      display: "flex",
      justifyContent: "space-between",
      gap: 8,
      padding: 12,
      borderTop: "1px solid #eee",
      background: "#fafafa",
      alignItems: "center",
    },
    muted: { color: "#888", fontSize: 12 },
    error: {
      marginBottom: 8,
      padding: "8px 10px",
      borderRadius: 8,
      border: "1px solid #ef4444",
      background: "#fee2e2",
      color: "#991b1b",
      fontSize: 13,
    },
  };

  return (
    <>
      <button
        type="button"
        className="admin-toggle"
        style={styles.toggle}
        onClick={() => setIsOpen((v) => !v)}
      >
        {isOpen ? "Cerrar" : "Panel Administración"}
      </button>

      {isOpen && (
        <div className="admin-panel" style={styles.panel}>
          <div className="admin-panel__header" style={styles.header}>
            <span>Administración de Zonas</span>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={styles.badge(dbOk === true)}>
                DB:{" "}
                {dbOk === null
                  ? "…"
                  : dbOk
                  ? "OK"
                  : "NO OK"}
                {dbMsg ? ` · ${dbMsg}` : ""}
              </span>
              <button
                type="button"
                title="Refrescar"
                style={styles.btn}
                onClick={refreshAll}
                disabled={loading}
              >
                {loading ? "Cargando..." : "Refrescar"}
              </button>
              <button
                type="button"
                title="Cerrar"
                style={styles.btn}
                onClick={() => setIsOpen(false)}
              >
                ×
              </button>
            </div>
          </div>

          <div style={styles.body}>
            {error && <div style={styles.error}>{error}</div>}

            {!dbOk && dbOk !== null && (
              <div style={styles.error}>
                La base no respondió OK. Verifica el endpoint de DB check en
                <code> DB_CHECK_PATHS </code>.
              </div>
            )}

            {/* Controles masivos */}
            <div className="admin-panel__section" style={{ marginBottom: 12 }}>
              <div style={styles.controls}>
                <select
                  style={styles.select}
                  value={applyAllValue}
                  onChange={(e) => setApplyAllValue(e.target.value)}
                  disabled={!dbOk || loading}
                >
                  <option value="">— Estado para TODAS —</option>
                  {stateOptions.map((op) => (
                    <option key={op} value={op}>
                      {op}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  style={{ ...styles.btn, ...styles.btnPrimary }}
                  onClick={handleApplyAll}
                  disabled={!applyAllValue || !zones.length || !dbOk || loading}
                  title={
                    !dbOk
                      ? "DB no OK"
                      : !zones.length
                      ? "Sin zonas"
                      : "Aplicar a todas"
                  }
                >
                  Aplicar a todas
                </button>
              </div>
              <div style={styles.muted}>
                Nota: los cambios aquí son locales (UI). Conecta tus endpoints de
                guardado si querés persistir.
              </div>
            </div>

            {/* Lista de zonas */}
            <div className="admin-panel__section">
              {dbOk && loading && (
                <div style={styles.muted}>Cargando zonas…</div>
              )}

              {dbOk && !loading && zones.length === 0 && (
                <div style={styles.muted}>No hay zonas para mostrar.</div>
              )}

              {dbOk &&
                zones.map((z) => {
                  const id = getZoneId(z);
                  const label = getZoneLabel(z);
                  const current = zoneStates?.[id] ?? "";

                  return (
                    <div key={id || label} className="admin-panel__row" style={styles.row}>
                      <div title={id ? `ID: ${id}` : undefined}>{label}</div>
                      <select
                        style={styles.select}
                        value={current}
                        onChange={(e) => handlePerZoneChange(id, e.target.value)}
                        disabled={loading}
                      >
                        <option value="">— Seleccionar —</option>
                        {stateOptions.map((op) => (
                          <option key={op} value={op}>
                            {op}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
            </div>
          </div>

          <div className="admin-panel__footer" style={styles.footer}>
            <span style={styles.muted}>
              {zones.length ? `${zones.length} zona(s)` : "Sin zonas"}
            </span>
            <span style={styles.muted}>
              {BACKEND_URL}
            </span>
          </div>
        </div>
      )}
    </>
  );
}
