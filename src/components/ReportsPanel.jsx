import React, { useEffect, useState } from "react";

const BACKEND_URL =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    (import.meta.env.VITE_REACT_APP_BACKEND_URL || import.meta.env.VITE_BACKEND_URL)) ||
  "https://cerro-largo-backend.onrender.com";

export default function ReportsPanel() {
  const [data, setData] = useState({ reportes: [], total: 0, pages: 0, current_page: 1, per_page: 10 });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = async (page = 1) => {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch(`${BACKEND_URL}/api/reportes?page=${page}&per_page=${data.per_page}`, {
        credentials: "include",
      });
      const json = await res.json();
      // Esperamos { reportes, total, pages, current_page, per_page }
      if (!json || !Array.isArray(json.reportes)) throw new Error("Respuesta inesperada");
      setData(json);
    } catch (e) {
      console.error(e);
      setErr("No se pudieron cargar los reportes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(1); }, []);

  const photoSrc = (ruta_archivo) => {
    const rel = String(ruta_archivo || "");
    // backend guarda "/uploads/reportes/xxx" => servir en /static/...
    return `${BACKEND_URL}/static${rel.startsWith("/") ? rel : `/${rel}`}`;
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
              </tr>
            </thead>
            <tbody>
              {data.reportes.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-3 whitespace-nowrap">
                    {r.fecha_creacion ? new Date(r.fecha_creacion).toLocaleString() : "-"}
                  </td>
                  <td className="p-3 max-w-md"><div className="line-clamp-3">{r.descripcion || "-"}</div></td>
                  <td className="p-3">{r.nombre_lugar || "-"}</td>
                  <td className="p-3">
                    {r.latitud != null && r.longitud != null
                      ? `${Number(r.latitud).toFixed(5)}, ${Number(r.longitud).toFixed(5)}`
                      : "-"}
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2 flex-wrap">
                      {(r.fotos || []).map((f) => (
                        <a key={f.id} href={photoSrc(f.ruta_archivo)} target="_blank" rel="noreferrer">
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
              className={`px-3 py-1 border rounded ${p === data.current_page ? "bg-black text-white" : "bg-white"}`}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
