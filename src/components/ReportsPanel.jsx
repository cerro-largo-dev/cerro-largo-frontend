// src/components/ReportsPanel.jsx
import React, { useEffect, useState } from "react";

const BACKEND_URL =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    (import.meta.env.VITE_REACT_APP_BACKEND_URL || import.meta.env.VITE_BACKEND_URL)) ||
  "https://cerro-largo-backend.onrender.com";

export default function ReportsPanel() {
  const [data, setData] = useState({
    reportes: [],
    total: 0,
    pages: 0,
    current_page: 1,
    per_page: 10,
  });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [busyId, setBusyId] = useState(null);

  const fmtFecha = (s) => {
    if (!s) return "-";
    // Si viene sin 'Z', asumimos UTC
    const iso = s.endsWith("Z") ? s : `${s}Z`;
    return new Date(iso).toLocaleString("es-UY", {
      timeZone: "America/Montevideo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const load = async (page = 1) => {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch(`${BACKEND_URL}/api/reportes?page=${page}&per_page=${data.per_page}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json || !Array.isArray(json.reportes)) throw new Error("Respuesta inesperada");
      setData(json);
    } catch (e) {
      console.error(e);
      setErr("No se pudieron cargar los reportes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const photoSrc = (ruta_archivo) => {
    const rel = String(ruta_archivo || "");
    // backend guarda "/uploads/reportes/xxx" => servir en /static/...
    return `${BACKEND_URL}/static${rel.startsWith("/") ? rel : `/${rel}`}`;
  };

  const handleDelete = async (id) => {
    if (!id) return;
    if (!window.confirm("¿Quieres borrar este reporte?")) return;
    try {
      setBusyId(id);
      const res = await fetch(`${BACKEND_URL}/api/reportes/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await load(data.current_page || 1);
    } catch (e) {
      console.error(e);
      alert("No se pudo borrar el reporte.");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <div className="p-4">Cargando…</div>;
  if (err) return <div className="p-4 text-red-600">{err}</div>;

  return (
    <div className="p-4 max-w-7xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Reportes ciudadanos</h1>

      {data.reportes.length === 0 ? (
        <div className="text-gray-600">No hay reportes.</div>
      ) : (
        <div className="overflow-x-auto border rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="text-left p-3">Fecha</th>
                <th className="text-left p-3">Descripción</th>
                <th className="text-left p-3">Lugar</th>
                <th className="text-left p-3">Lat/Lon</th>
                <th className="text-left p-3">Fotos</th>
                <th className="text-left p-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {data.reportes.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-3 whitespace-nowrap">
                    {/* tamaño pequeño para fecha/hora */}
                    <span className="text-xs text-gray-700">{fmtFecha(r.fecha_creacion)}</span>
                  </td>
                  <td className="p-3 max-w-md">
                    <div className="line-clamp-3">{r.descripcion || "-"}</div>
                  </td>
                  <td className="p-3">{r.nombre_lugar || "-"}</td>
                  <td className="p-3">
                    {r.latitud != null && r.longitud != null
                      ? `${Number(r.latitud).toFixed(5)}, ${Number(r.longitud).toFixed(5)}`
                      : "-"}
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2 flex-wrap">
                      {(r.fotos || []).map((f) => (
                        <a key={f.id} href={photoSrc(f.ruta_archivo)} target="__blank" rel="noreferrer">
                          <img
                            src={photoSrc(f.ruta_archivo)}
                            alt={f.nombre_archivo || "foto"}
                            className="w-16 h-16 object-cover rounded"
                            loading="lazy"
                          />
                        </a>
                      ))}
                    </div>
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => handleDelete(r.id)}
                      disabled={busyId === r.id}
                      title="Borrar reporte"
                      className="px-2 py-1 border rounded text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      {busyId === r.id ? "Borrando…" : "✕"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data.pages > 1 && (
        <div className="flex gap-2 mt-4">
          {Array.from({ length: data.pages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => load(p)}
              className={`px-3 py-1 border rounded ${
                p === data.current_page ? "bg-black text-white" : "bg-white"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
