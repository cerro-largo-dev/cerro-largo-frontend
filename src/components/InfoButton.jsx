import React from 'react';

/**
 * Botón redondo de información (idéntico al botón de reporte ciudadano en tamaño/color),
 * con ícono “i”. Cuando se hace click, ejecuta onClick().
 */
export default function InfoButton({ onClick, title = 'Información' }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className="fixed bottom-24 left-4 z-[998] bg-blue-600 text-white w-14 h-14 rounded-full shadow-lg hover:bg-blue-700 focus:outline-none flex items-center justify-center"
    >
      {/* Ícono info */}
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    </button>
  );
}
