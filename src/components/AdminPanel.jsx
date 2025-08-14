// AdminPanel.jsx
import React, { useEffect, useMemo, useState } from "react";

/**
 * AdminPanel unificado
 *
 * Características:
 * - Toggle flotante inferior (mostrar/ocultar panel).
 * - Autenticación con cookie de sesión: check-auth / login / logout.
 * - Carga de zonas desde /api/admin/zones.
 * - Actualización de estado por zona y actualización masiva (loop sobre update-state).
 * - Descarga de reporte PDF desde /api/report/generate-pdf.
 * - Indicador de salud DB desde /api/admin/db-check (opcional).
 * - Callbacks opcionales: onZoneStateChange, onBulkZoneStatesUpdate, onRefreshZoneStates.
 *
 * Props opcionales:
 * - backendUrl: string. Por defecto "https://cerro-largo-backend.onrender.com".
 * - initiallyVisible: boolean. Panel desplegado al inicio (false por defecto).
 * - onZoneStateChange(zoneName, stateEn)
 * - onBulkZoneStatesUpdate(zonesArray, stateEn)
 * - onRefreshZoneStates()
 */
export default function AdminPanel({
  backendUrl = "https://cerro-largo-backend.onrender.com",
  initiallyVisible = false,
  onZoneStateChange,
  onBulkZoneStatesUpdate,
  onRefreshZoneStates,
}) {
  // UI
  const [isVisible, setIsVisible] = useState(initiallyVisible);
  const [isLoading, setIsLoading] = useState(false);
  const [busyMsg, setBusyMsg] = useState("");

  // Auth
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [email, setEmail] = useState(""); // opcional si backend lo requiere
  const [password, setPassword] = useState("");

  // Data
  const [zones, setZones] = useState([]); // [{name, state}]
  const [selectedZone, setSelectedZone] = useState("");
  const [selectedZones, setSelectedZones] = useState([]); // para bulk
  const [selectedState, setSelectedState] = useState("green"); // interno en inglés
  const [dbHealthy, setDbHealthy] = useState(null); // true/false/null

  // Helpers de estado (interno en inglés; UI en español)
  const esToEn = { verde: "green", amarillo: "yellow", rojo: "red" };
  const enToEs = { green: "verde", yellow: "amarillo", red: "rojo" };

  const stateLabel = useMemo(
    () => ({
      green: "🟩 Habilitado",
      yellow: "🟨 Alerta",
      red: "🟥 Suspendido",
    }),
    []
  );

  const getStateColor = (s) =>
    s === "green" ? "#22c55e" : s === "yellow" ? "#eab308" : s === "red" ? "#ef4444" : "#6b7280";

  // Normaliza valores de state recibidos (acepta 'verde/amarillo/rojo' o 'green/yellow/red')
  const normalizeState = (value) => {
    if (!value) return null;
    const v = String(value).toLowerCase();
    if (v in enToEs) return v; // ya es en
    if (v in esToEn) return esToEn[v]; // convertir a en
    return null;
  };

  // --- API helpers
  const api = (path, init = {}) =>
    fetch(`${backendUrl}${path}`, { credentials: "include", ...init });

  const checkAuthentication = async () => {
    try {
      const res = await api("/api/admin/check-auth");
      const data = await res.json().catch(() => ({}));
      setIsAuthenticated(Boolean(data?.authenticated || data?.success));
    } catch (e) {
      console.error("check-auth error:", e);
      setIsAuthenticated(false);
    } finally {
      setAuthChecking(false);
    }
  };

  const login = async (e) => {
    e?.preventDefault?.();
    setIsLoading(true);
    setBusyMsg("Verificando credenciales…");
    try {
      const body =
        email?.trim()
          ? { email: email.trim(), password }
          : { password };
      const res = await api("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && (data?.success || data?.authenticated)) {
        setIsAuthenticated(true);
        setPassword("");
        await Promise.all([loadZones(), dbCheck()]);
        alert("Autenticación exitosa");
      } else {
        alert(data?.message || "Contraseña o credenciales incorrectas");
      }
    } catch (e) {
      console.error("login error:", e);
      alert("Error de conexión");
    } finally {
      setIsLoading(false);
      setBusyMsg("");
    }
  };

  const logout = async () => {
    try {
      await api("/api/admin/logout", { method: "POST" });
      setIsAuthenticated(false);
      setIsVisible(false);
    } catch (e) {
      console.error("logout error:", e);
    }
  };

  const dbCheck = async () => {
    try {
      const res = await api("/api/admin/db-check");
      setDbHealthy(res.ok);
    } catch {
      setDbHealthy(false);
    }
  };

  const loadZones = async () => {
    try {
      const res = await api("/api/admin/zones");
      if (!res.ok) return;
      const data = await res.json();
      // Se espera: array [{name, state}]
      const normalized = Array.isArray(data)
        ? data.map((z) => ({
            name: z?.name || z?.zone || "",
            state: normalizeState(z?.state) || "yellow",
          }))
        : [];
      setZones(normalized);
    } catch (e) {
      console.error("loadZones error:", e);
    }
  };

  const updateZoneState = async (zoneName, stateEn) => {
    const body = { zone_name: zoneName, state: stateEn };
    const res = await api("/api/admin/zones/update-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) {
      throw new Error(data?.message || "Falló la actualización");
    }
  };

  const handleUpdateSingle = async () => {
    if (!selectedZone || !selectedState) {
      alert("Selecciona una zona y un estado");
      return;
    }
    setIsLoading(true);
    setBusyMsg("Actualizando estado…");
    try {
      await updateZoneState(selectedZone, selectedState);
      // Refrescar
      await loadZones();
      onZoneStateChange?.(selectedZone, selectedState);
      alert("Estado actualizado correctamente");
      setSelectedZone("");
      setSelectedState("green");
    } catch (e) {
      console.error(e);
      alert(e.message || "Error al actualizar estado");
    } finally {
      setIsLoading(false);
      setBusyMsg("");
    }
  };

  const handleUpdateBulk = async () => {
    if (!selectedZones.length || !selectedState) {
      alert("Selecciona una o más zonas y un estado");
      return;
    }
    setIsLoading(true);
    setBusyMsg(`Actualizando ${selectedZones.length} zonas…`);
    try {
      for (const zn of selectedZones) {
        // Ejecuta en serie para evitar saturar el backend
        // (si prefieres en paralelo, usa Promise.all)
        await updateZoneState(zn, selectedState);
      }
      await loadZones();
      onBulkZoneStatesUpdate?.(selectedZones, selectedState);
      alert("Actualización masiva completada");
      setSelectedZones([]);
      setSelectedState("green");
    } catch (e) {
      console.error(e);
      alert(e.message || "Error en actualización masiva");
    } finally {
      setIsLoading(false);
      setBusyMsg("");
    }
  };

  const downloadReport = async () => {
    setIsLoading(true);
    setBusyMsg("Generando reporte…");
    try {
      const res = await api("/api/report/generate-pdf", { method: "GET" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || "No se pudo generar el reporte");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = `reporte_camineria_cerro_largo_${new Date()
        .toISOString()
        .slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      alert("Reporte descargado");
    } catch (e) {
      console.error(e);
      alert(e.message || "Error al descargar reporte");
    } finally {
      setIsLoading(false);
      setBusyMsg("");
    }
  };

  const refreshAll = async () => {
    setIsLoading(true);
    setBusyMsg("Actualizando datos…");
    try {
      await Promise.all([loadZones(), dbCheck()]);
      onRefreshZoneStates?.();
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
      setBusyMsg("");
    }
  };

  // --- effects
  useEffect(() => {
    checkAuthentication();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      refreshAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // --- UI
  const dbPill =
    dbHealthy == null
      ? "bg-gray-200 text-gray-700"
      : dbHealthy
      ? "bg-green-100 text-green-700"
      : "bg-red-100 text-red-700";

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[1000]">
        <button
          onClick={() => setIsVisible(true)}
          className="bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-gray-700 transition-colors"
        >
          ▲ Admin
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-300 shadow-lg z-[1000] p-4">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-gray-800">
              Panel de Administración
            </h3>
            <span
              className={`text-xs px-2 py-1 rounded ${dbPill}`}
              title="Estado de base de datos"
            >
              DB:{" "}
              {dbHealthy == null ? "—" : dbHealthy ? "OK" : "Error"}
            </span>
            {isLoading && (
              <span className="text-xs text-gray-500">{busyMsg}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isAuthenticated && (
              <>
                <button
                  onClick={refreshAll}
                  className="text-sm bg-slate-100 hover:bg-slate-200 border border-slate-300 px-3 py-1.5 rounded"
                >
                  ↻ Refrescar
                </button>
                <button
                  onClick={downloadReport}
                  className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded"
                >
                  📄 Reporte
                </button>
              </>
            )}
            <button
              onClick={() => setIsVisible(false)}
              className="text-gray-600 hover:text-gray-800 text-xl leading-none"
            >
              ✕
            </button>
          </div>
        </div>

        {!isAuthenticated ? (
          <form
            onSubmit={login}
            className="mt-4 flex flex-wrap items-end gap-3"
          >
            <div className="flex flex-col">
              <label className="text-xs text-gray-600">Email (opcional)</label>
              <input
                type="email"
                value={email}
                autoComplete="username"
                onChange={(e) => setEmail(e.target.value)}
                className="border border-gray-300 rounded px-3 py-2 text-sm min-w-[260px]"
                placeholder="admin@dominio (si tu backend lo requiere)"
                disabled={authChecking || isLoading}
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs text-gray-600">Contraseña</label>
              <input
                type="password"
                value={password}
                autoComplete="current-password"
                onChange={(e) => setPassword(e.target.value)}
                className="border border-gray-300 rounded px-3 py-2 text-sm min-w-[220px]"
                placeholder="••••••••"
                disabled={authChecking || isLoading}
              />
            </div>
            <button
              type="submit"
              disabled={authChecking || isLoading || !password}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors text-sm"
            >
              {isLoading ? "Verificando…" : "Ingresar"}
            </button>
          </form>
        ) : (
          <>
            {/* Controles de actualización */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="border rounded-lg p-3">
                <h4 className="font-medium text-sm mb-2">Actualización individual</h4>
                <div className="flex flex-col gap-2">
                  <select
                    className="border border-gray-300 rounded px-3 py-2 text-sm"
                    value={selectedZone}
                    onChange={(e) => setSelectedZone(e.target.value)}
                  >
                    <option value="">Seleccionar zona…</option>
                    {zones.map((z) => (
                      <option key={z.name} value={z.name}>
                        {z.name} —{" "}
                        {stateLabel[normalizeState(z.state) || "yellow"]}
                      </option>
                    ))}
                  </select>

                  <select
                    className="border border-gray-300 rounded px-3 py-2 text-sm"
                    value={selectedState}
                    onChange={(e) => setSelectedState(e.target.value)}
                  >
                    <option value="green">🟩 Habilitado</option>
                    <option value="yellow">🟨 Alerta</option>
                    <option value="red">🟥 Suspendido</option>
                  </select>

                  <button
                    onClick={handleUpdateSingle}
                    disabled={!selectedZone || isLoading}
                    className="bg-green-600 text-white px-3 py-2 rounded text-sm hover:bg-green-700 disabled:bg-gray-400"
                  >
                    {isLoading ? "Actualizando…" : "Actualizar estado"}
                  </button>
                </div>
              </div>

              <div className="border rounded-lg p-3 md:col-span-2">
                <h4 className="font-medium text-sm mb-2">Actualización masiva</h4>
                <div className="flex flex-col gap-2 max-h-44 overflow-auto border rounded p-2">
                  {zones.map((z) => (
                    <label key={z.name} className="text-sm flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedZones.includes(z.name)}
                        onChange={(e) => {
                          setSelectedZones((prev) =>
                            e.target.checked
                              ? [...prev, z.name]
                              : prev.filter((n) => n !== z.name)
                          );
                        }}
                      />
                      <span className="flex-1">
                        {z.name} —{" "}
                        <span style={{ color: getStateColor(normalizeState(z.state)) }}>
                          {stateLabel[normalizeState(z.state) || "yellow"]}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>

                <div className="mt-2 flex items-center gap-2">
                  <select
                    className="border border-gray-300 rounded px-3 py-2 text-sm"
                    value={selectedState}
                    onChange={(e) => setSelectedState(e.target.value)}
                  >
                    <option value="green">🟩 Habilitado</option>
                    <option value="yellow">🟨 Alerta</option>
                    <option value="red">🟥 Suspendido</option>
                  </select>
                  <button
                    onClick={handleUpdateBulk}
                    disabled={!selectedZones.length || isLoading}
                    className="bg-amber-600 text-white px-3 py-2 rounded text-sm hover:bg-amber-700 disabled:bg-gray-400"
                  >
                    {isLoading ? "Actualizando…" : `Aplicar a ${selectedZones.length} zona(s)`}
                  </button>
                </div>
              </div>
            </div>

            {/* Lista de estados actuales */}
            <div className="mt-4 border rounded-lg p-3">
              <h4 className="font-medium text-sm mb-2">Estados actuales</h4>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2">
                {zones.map((z) => {
                  const st = normalizeState(z.state) || "yellow";
                  return (
                    <div
                      key={z.name}
                      className="flex items-center justify-between border rounded px-3 py-2 text-sm"
                    >
                      <span className="font-medium">{z.name}</span>
                      <span style={{ color: getStateColor(st) }}>
                        {stateLabel[st]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Acciones inferiores */}
            <div className="mt-4 flex items-center justify-between">
              <button
                onClick={logout}
                className="text-sm bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded"
              >
                Cerrar sesión
              </button>
              <div className="text-xs text-gray-500">
                Backend: <code>{backendUrl}</code>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
