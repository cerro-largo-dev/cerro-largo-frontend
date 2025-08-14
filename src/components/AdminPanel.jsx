import React, { useMemo, useState } from "react";

/**
 * AdminPanel
 *
 * Props:
 * - zones: Array<string|number|object>   // lista de zonas (id/nombre u objeto)
 * - zoneStates: Record<string, string>   // { [zoneId]: state }
 * - onZoneStateChange?: (zoneId, newState) => void
 * - onBulkUpdate?: (updates: Record<string,string>) => void
 * - onBulkZoneStatesUpdate?: (updates: Record<string,string>) => void // alias compatible
 * - onRefreshZoneStates?: () => void
 * - stateOptions?: string[]              // ej. ["OK","PRECAUCIÓN","CERRADA"]
 */
export default function AdminPanel({
  zones = [],
  zoneStates = {},
  onZoneStateChange,
  onBulkUpdate,
  onBulkZoneStatesUpdate,
  onRefreshZoneStates,
  stateOptions,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [applyAllValue, setApplyAllValue] = useState("");

  const options = useMemo(
    () => stateOptions && stateOptions.length
      ? stateOptions
      : ["OK", "PRECAUCIÓN", "CERRADA"],
    [stateOptions]
  );

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

  const bulkFn = onBulkUpdate || onBulkZoneStatesUpdate;

  const handleApplyAll = () => {
    if (!applyAllValue) return;
    const updates = {};
    for (const z of zones) {
      const id = getZoneId(z);
      if (id) updates[id] = applyAllValue;
    }
    if (Object.keys(updates).length && typeof bulkFn === "function") {
      bulkFn(updates);
    }
  };

  const handlePerZoneChange = (zoneId, newState) => {
    if (typeof onZoneStateChange === "function") {
      onZoneStateChange(zoneId, newState);
    }
  };

  // Estilos mínimos en línea para que funcione sin CSS externo.
  // Si ya tienes clases .admin-toggle / .admin-panel en tu proyecto,
  // se aplicarán encima sin problema.
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
      width: 360,
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
    body: {
      padding: 12,
      overflow: "auto",
    },
    row: {
      display: "grid",
      gridTemplateColumns: "1fr 140px",
      gap: 8,
      alignItems: "center",
      padding: "6px 0",
      borderBottom: "1px dashed #f0f0f0",
    },
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
      justifyContent: "flex-end",
      gap: 8,
      padding: 12,
      borderTop: "1px solid #eee",
      background: "#fafafa",
    },
    muted: { color: "#888", fontSize: 12 },
  };

  return (
    <>
      {/* Botón flotante para abrir/cerrar */}
      <button
        type="button"
        className="admin-toggle"
        style={styles.toggle}
        onClick={() => setIsOpen((v) => !v)}
      >
        {isOpen ? "Cerrar" : "Panel Administración"}
      </button>

      {/* Panel */}
      {isOpen && (
        <div className="admin-panel" style={styles.panel}>
          <div className="admin-panel__header" style={styles.header}>
            <span>Administración de Zonas</span>
            <div style={{ display: "flex", gap: 8 }}>
              {typeof onRefreshZoneStates === "function" && (
                <button
                  type="button"
                  title="Refrescar"
                  style={styles.btn}
                  onClick={onRefreshZoneStates}
                >
                  Refrescar
                </button>
              )}
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
            {/* Controles masivos */}
            <div className="admin-panel__section" style={{ marginBottom: 12 }}>
              <div style={styles.controls}>
                <select
                  style={styles.select}
                  value={applyAllValue}
                  onChange={(e) => setApplyAllValue(e.target.value)}
                >
                  <option value="">— Estado para TODAS —</option>
                  {options.map((op) => (
                    <option key={op} value={op}>
                      {op}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  style={{ ...styles.btn, ...styles.btnPrimary }}
                  onClick={handleApplyAll}
                  disabled={!applyAllValue || !zones.length || !bulkFn}
                  title={
                    bulkFn
                      ? "Aplicar a todas las zonas"
                      : "Falta prop onBulkUpdate/onBulkZoneStatesUpdate"
                  }
                >
                  Aplicar a todas
                </button>
              </div>
              {!bulkFn && (
                <div style={styles.muted}>
                  Sugerencia: pasa <code>onBulkUpdate</code> o{" "}
                  <code>onBulkZoneStatesUpdate</code> para aplicar cambios masivos.
                </div>
              )}
            </div>

            {/* Lista de zonas */}
            <div className="admin-panel__section">
              {zones.length === 0 ? (
                <div style={styles.muted}>No hay zonas para mostrar.</div>
              ) : (
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
                      >
                        <option value="">— Seleccionar —</option>
                        {options.map((op) => (
                          <option key={op} value={op}>
                            {op}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="admin-panel__footer" style={styles.footer}>
            <span style={styles.muted}>
              {zones.length
                ? `${zones.length} zona(s)`
                : "Sin zonas cargadas"}
            </span>
          </div>
        </div>
      )}
    </>
  );
}
