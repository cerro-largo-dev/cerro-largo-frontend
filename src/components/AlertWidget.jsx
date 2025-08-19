import React, { useEffect, useState } from "react";

export default function AlertWidget() {
  const [alerta, setAlerta] = useState(null);
  const [visible, setVisible] = useState(true);

  // Construye la URL en runtime (prioriza variables globales del index.html)
  const getApiUrl = () => {
    const be =
      (typeof window !== "undefined" &&
        (window.BACKEND_URL || window.API_BASE_URL)) ||
      import.meta.env.VITE_REACT_APP_BACKEND_URL ||
      "";
    return `${be}/api/inumet/alerts/cerro-largo`;
  };

  const loadAlert = async () => {
    const API = getApiUrl();
    if (!API || API.startsWith("/api/")) {
      console.warn("[AlertWidget] BACKEND_URL/API_BASE_URL no definido");
      return;
    }
    try {
      const res = await fetch(API, { credentials: "include" });

      // Si viene HTML (errores 404/500), evito parsear como JSON
      if (!res.ok) {
        const body = await res.text();
        throw new Error(
          `HTTP ${res.status} ${res.statusText} — ${body.slice(0, 200)}`
        );
      }

      const data = await res.json();

      if (data?.ok && Array.isArray(data.alerts) && data.alerts.length) {
        const a = data.alerts[0]; // más severa/reciente primero
        setAlerta({
          phen: a.name || "Alerta INUMET",
          level: Number(a.level || 0), // 1=Amarilla, 2=Naranja, 3=Roja
          provider_name: "INUMET Uruguay",
          description: a.description || "",
        });
        setVisible(true);
      } else {
        setAlerta(null);
      }
    } catch (e) {
      console.error("Error consulta INUMET:", e);
      setAlerta(null);
    }
  };

  useEffect(() => {
    loadAlert();
    const timer = setInterval(loadAlert, 10 * 60 * 1000); // 10 minutos
    return () => clearInterval(timer);
  }, []);

  if (!alerta || !visible) return null;

  const colors = {
    1: "bg-yellow-400",
    2: "bg-orange-500",
    3: "bg-red-600",
  };

  return (
    <div
      role="status"
      className={`fixed bottom-4 right-4 z-[1500] p-2 rounded-lg shadow-xl text-white flex items-center gap-2 ${
        colors[alerta.level] || "bg-gray-400"
      }`}
      style={{ fontSize: "10px" }}
      title={alerta.description}
    >
      <img
        src="https://services.meteored.com/web/viewer/css/svgs/warnings/2.svg"
        alt="Alerta"
        className="w-5 h-5"
      />
      <div className="flex flex-col max-w-[180px] leading-tight">
        <span className="font-semibold">{alerta.phen}</span>
        <span>— {alerta.provider_name}</span>
      </div>
      <button
        onClick={() => setVisible(false)}
        className="ml-1 text-xs font-bold"
        style={{ lineHeight: 1 }}
        aria-label="Cerrar alerta"
      >
        ×
      </button>
    </div>
  );
}
