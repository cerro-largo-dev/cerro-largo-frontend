// src/components/ReportsPanel.jsx
import React, { useEffect, useState } from "react";

export default function ReportsPanel() {
  const [reportes, setReportes] = useState([]);
  const [loading, setLoading] = useState(true);
  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "https://cerro-largo-backend.onrender.com";

  useEffect(() => {
    async function fetchReportes() {
      try {
        const res = await fetch(`${BACKEND_URL}/api/reportes`);
        if (!res.ok) throw new Error("Error al cargar reportes");
        const data = await res.json();
        setReportes(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchReportes();
  }, []);

  if (loading) return <p className="p-4">Cargando reportes...</p>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Reportes Ciudadanos</h1>
      {reportes.length === 0 ? (
        <p>No hay reportes registrados.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {reportes.map((reporte) => (
            <div key={reporte.id} className="border rounded-lg p-4 shadow bg-white">
              <h2 className="font-semibold text-lg mb-2">{reporte.descripcion}</h2>
              <p className="text-sm text-gray-600 mb-2">
                {reporte.nombre_lugar || "Sin lugar"} —{" "}
                {new Date(reporte.fecha_creacion).toLocaleString()}
              </p>
              {reporte.fotos && reporte.fotos.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {reporte.fotos.map((foto) => (
                    <img
                      key={foto.id}
                      src={`${BACKEND_URL}/static/${foto.ruta_archivo}`}
                      alt={foto.nombre_archivo}
                      className="w-32 h-32 object-cover rounded"
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
