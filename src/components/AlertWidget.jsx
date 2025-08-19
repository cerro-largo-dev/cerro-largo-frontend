import React, { useEffect, useState } from "react";

export default function AlertWidget() {
  const [alerta, setAlerta] = useState(null);
  const [visible, setVisible] = useState(true);

  // Lee tu backend ya filtrado a Cerro Largo
  const be = (typeof window !== "undefined" && window.BACKEND_URL) || "";
  const API = `${be}/api/inumet/alerts/cerro-largo`;

  const loadAlert = async () => {
    try {
      const res = await fetch(API, { credentials: "include" });
      const data = await res.json();

      if (data?.ok && Array.isArray(data.alerts) && data.alerts.length) {
        const a = data.alerts[0]; // más severa primero
        setAlerta({
          phen: a.name || "Alerta INUMET",
          level: Number(a.level || 0), // 1=Amarilla, 2=Naranja, 3=Roja
          provider_name: "INUMET Uruguay",
          description: a.description || "",
        });
        setVisible(true); // si estaba cerrada, vuelve si hay nueva alerta
      } else {
        setAlerta(null);
      }
    } catch (e) {
      console.error("Error consulta INUMET:", e);
    }
  };

  // Primera carga + auto refresh 10 min
  useEffect(() => {
    loadAlert();
    const timer = setInterval(loadAlert, 10 * 60 * 1000);
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
