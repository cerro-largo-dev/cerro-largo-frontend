import React, { useCallback } from 'react';

/**
 * Botón público "Reporte"
 * - Ubicación: arriba-derecha (fixed), reemplaza al antiguo "Descargar reporte".
 * - Acción: toggle del panel ReportHubPanel, anclando el popover justo DEBAJO del botón.
 *
 * Props:
 *  - open: boolean          → estado abierto/cerrado del popover (lo maneja App.jsx)
 *  - onToggle: fn(isOpen, anchorRect) → callback para abrir/cerrar y pasar el rect del botón
 */
export default function ReportHubButton({ open = false, onToggle }) {
  const handleClick = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (typeof onToggle === 'function') onToggle(!open, rect);
  }, [open, onToggle]);

  return (
    <div className="fixed top-4 right-4 z-[1000]" aria-live="polite">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open ? 'true' : 'false'}
        aria-controls="report-hub-panel"
        onClick={handleClick}
        className={[
          // base
          'px-4 h-10 rounded-full border-0 cursor-pointer select-none',
          'shadow-lg hover:shadow-xl transition-all duration-200',
          'text-white font-medium',
          // color
          open ? 'bg-blue-700' : 'bg-blue-600 hover:bg-blue-700',
          // layout
          'flex items-center gap-2'
        ].join(' ')}
        title="Reporte"
      >
        {/* Ícono simple */}
        <svg
          aria-hidden="true"
          className="w-5 h-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
        >
          <path d="M7 4h10a2 2 0 0 1 2 2v13l-4-3-4 3-4-3-4 3V6a2 2 0 0 1 2-2Z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>Reporte</span>
      </button>
    </div>
  );
}
