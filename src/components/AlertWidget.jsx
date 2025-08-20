// AlertWidget.jsx
import React, { useEffect, useRef, useState } from "react";

export default function AlertWidget() {
  const [alerta, setAlerta] = useState(null);
  const [visible, setVisible] = useState(true);
  const inFlight = useRef(false);
  const abortRef = useRef(null);

  // Resuelve la base del backend
  const getBackendBase = () => {
    const be =
      (typeof window !== "undefined" &&
        (window.BACKEND_URL || window.API_BASE_URL)) ||
      (typeof import.meta !== "undefined" &&
        import.meta.env &&
        (import.meta.env.VITE_REACT_APP_BACKEND_URL ||
          import.meta.env.VITE_BACKEND_URL ||
          import.meta.env.VITE_API_BASE)) ||
      (typeof process !== "undefined" &&
        process.env &&
        (process.env.REACT_APP_BACKEND_URL ||
          process.env.VITE_BACKEND_URL ||
          process.env.API_BASE_URL)) ||
      (typeof window !== "undefined" ? window.location.origin : ""); // fallback al mismo origen
    return String(be).replace(/\/$/, "");
  };

  const getApiUrl = () => `${getBackendBase()}/api/inumet/alerts/cerro-largo`;

  const useCreds =
    (typeof window !== "undefined" && !!window.BACKEND_CREDENTIALS) ||
    (typeof import.meta !== "undefined" &&
      import.meta.env &&
      !!import.meta.env.VITE_BACKEND_CREDENTIALS) ||
    (typeof process !== "undefined" &&
      process.env &&
      !!process.env.REACT_APP_BACKEND_CREDENTIALS);

  const loadAlert = async () => {
    if (inFlight.current) return; // evita solapes si la petición tarda
    inFlight.current = true;

    // cancela petición anterior si existiera
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const API = getApiUrl();
    if (process.env.NODE_ENV !== "production") {
      console.log("[AlertWidget] API =", API);
    }

    try {
      const res = await fetch(API, {
        method: "GET",
        headers: { Accept: "application/json" },
        credentials: useCreds ? "include" : "omit",
        cache: "no-store",
        signal: controller.signal,
        mode: "cors",
      });

      const ct = res.headers.get("content-type") || "";
      const raw = await res.text();

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText} — ${raw.slice(0, 200)}`);
      }
      if (!ct.includes("application/json")) {
        throw new Error(`No-JSON — ${raw.slice(0, 200)}`);
      }

      const data = JSON.parse(raw);

      if (data?.ok && Array.isArray(data.alerts) && data.alerts.length > 0) {
        const a = data.alerts[0]; // más severa/reciente primero
        setAlerta({
          phen: a.name || "Alerta INUMET",
          level: Number(a.level || 0), // 1=Amarilla, 2=Naranja, 3=Roja
          provider_name: "INUMET Uruguay",
          description: a.description || "",
        });
        setVisible(true);
      } else {
        setAlerta(null); // sin alertas activas → no mostrar
      }
    } catch (e) {
      if (e.name !== "AbortError") {
        console.error("Error consulta INUMET:", e);
        setAlerta(null);
      }
    } finally {
      inFlight.current = false;
    }
  };

  // Primera carga + refresco cada 10 min
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.log("[AlertWidget] montado");
    }
    loadAlert();
    const timer = setInterval(loadAlert, 10 * 60 * 1000);
    return () => {
      clearInterval(timer);
      if (abortRef.current) abortRef.current.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      aria-live="polite"
    >
      <img
        src="https://services.meteored.com/web/viewer/css/svgs/warnings/2.svg"
        alt="Alerta meteorológica"
        className="w-5 h-5"
        loading="lazy"
        decoding="async"
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
        type="button"
      >
        ×
      </button>
    </div>
  );
}
