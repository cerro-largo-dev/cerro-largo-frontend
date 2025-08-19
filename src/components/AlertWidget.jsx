import React, { useEffect, useState } from "react";

export default function AlertWidget() {
  const [alerta, setAlerta] = useState(null);

  // Puedes poner más IDs dentro del arreglo:
  const GROUP_IDS = [
    "0328baafbf8b3d091b5bfc28c1db66ad",   // naranja por ejemplo
    "3ec26314fec562fadd3528e2d4b63461"    // amarilla por ejemplo
  ];

  useEffect(() => {
    // Trae todas las alertas en paralelo
    Promise.all(
      GROUP_IDS.map((id) =>
        fetch(`https://services.meteored.com/web/warnings/v4/group/${id}/es/`)
          .then((r) => r.json())
          .catch(() => null)
      )
    ).then((arr) => {
      const todas = [];

      arr.forEach((data) => {
        const alertas = data?.data?.respuesta?.alertas;
        if (alertas?.length) {
          const w = alertas[0].group.warnings.days[0].warnings[0];
          todas.push(w);
        }
      });

      // elegimos la de riesgo más alto
      if (todas.length) {
        todas.sort((a, b) => b.risk - a.risk);
        setAlerta(todas[0]);
      }
    });
  }, []);

  if (!alerta) return null;

  const colors = {
    1: "bg-yellow-400",
    2: "bg-orange-500",
    3: "bg-red-600"
  };

  return (
    <div className={`fixed bottom-4 right-4 z-[1500] p-3 rounded-lg shadow-xl text-white flex items-center gap-2 ${colors[alerta.risk] || "bg-gray-400"}`}>
      <img
        src="https://services.meteored.com/web/viewer/css/svgs/warnings/2.svg"
        alt="Alerta"
        className="w-6 h-6"
      />
      <div className="flex flex-col max-w-[220px] text-xs">
        <span className="font-semibold">{alerta.phen}</span>
        <span className="truncate">{alerta.description}</span>
      </div>
    </div>
  );
}
