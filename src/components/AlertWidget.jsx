import React, { useEffect, useState } from "react";

export default function AlertWidget() {
  const [alerta, setAlerta] = useState(null);
  const [visible, setVisible] = useState(true);

  const API = "https://services.meteored.com/web/warnings/v4/current/uruguay/es/";

  // Función para cargar desde la API
  const loadAlert = async () => {
    try {
      const res = await fetch(API);
      const data = await res.json();
      const allGroups = data?.data?.respuesta?.alertas || [];

      const enCerroLargo = [];
      allGroups.forEach((grp) => {
        const w = grp.group.warnings.days[0].warnings[0];
        const scope = (w?.scope ?? "").toLowerCase();
        if (scope.includes("cerro largo")) {
          const provider = Object.values(grp.providers || {})[0];
          w.provider_name = provider?.name || "Proveedor";
          enCerroLargo.push(w);
        }
      });

      if (enCerroLargo.length) {
        enCerroLargo.sort((a, b) => b.risk - a.risk);
        setAlerta(enCerroLargo[0]);
        setVisible(true); // volver a mostrar si desapareció
      } else {
        setAlerta(null);
      }
    } catch (e) {
      console.error("Error consulta Meteored:", e);
    }
  };

  // Primera carga + autorefresco cada 10 min
  useEffect(() => {
    loadAlert();
    const timer = setInterval(loadAlert, 10 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  if (!alerta || !visible) return null;

  const colors = {
    1: "bg-yellow-400",
    2: "bg-orange-500",
    3: "bg-red-600"
  };

  return (
    <div
      className={`fixed bottom-4 right-4 z-[1500] p-2 rounded-lg shadow-xl text-white flex items-center gap-2 ${colors[alerta.risk] || "bg-gray-400"}`}
      style={{ fontSize: "10px" }}
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
      >
        ×
      </button>
    </div>
  );
}
