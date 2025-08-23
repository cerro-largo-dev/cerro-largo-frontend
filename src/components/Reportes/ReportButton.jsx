// src/components/Reportes/ReportButton.jsx
import React, { forwardRef, useEffect, useState } from "react";

/**
 * Botón flotante para abrir/cerrar el panel de Reporte Ciudadano.
 * - Si recibís `isOpen` como prop, el ícono se sincroniza con ese estado.
 * - Si NO se pasa `isOpen`, maneja un estado interno solo para el ícono.
 */
const ReportButton = forwardRef(function ReportButton(
  { onClick, isOpen: controlledOpen, title = "Crear Reporte", ariaLabel = "Crear un nuevo reporte" },
  ref
) {
  const isControlled = typeof controlledOpen === "boolean";
  const [localOpen, setLocalOpen] = useState(false);

  // sincroniza el ícono si el componente es controlado
  useEffect(() => {
    if (isControlled) setLocalOpen(controlledOpen);
  }, [controlledOpen, isControlled]);

  const handleClick = () => {
    if (!isControlled) setLocalOpen((v) => !v);
    onClick && onClick();
  };

  const open = isControlled ? controlledOpen : localOpen;

  return (
    <button
      ref={ref}
      onClick={handleClick}
      className="h-14 w-14 rounded-full bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center border-none cursor-pointer report-fab"
      aria-label={ariaLabel}
      title={title}
      type="button"
    >
      {open ? (
        // Ícono "cerrar"
        <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      ) : (
        // Ícono "chat/burbuja" para crear reporte
        <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>
      )}
    </button>
  );
});

export default ReportButton;
