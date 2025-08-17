import React from 'react';

/**
 * Componente ReportButton
 * 
 * Muestra un botón de acción flotante (FAB) para iniciar el proceso de reporte.
 * Este componente es "tonto" (presentacional), ya que no maneja su propio estado.
 * Delega el evento de clic a su componente padre a través de la prop `onClick`.
 *
 * @param {object} props - Propiedades del componente.
 * @param {Function} props.onClick - La función a ejecutar cuando se hace clic en el botón.
 */
export default function ReportButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="h-14 w-14 rounded-full bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center border-none cursor-pointer"
      aria-label="Crear un nuevo reporte"
      title="Crear Reporte"
    >
      {/* 
        El ícono es estático. El estado de si el modal está abierto o cerrado
        ya no se gestiona aquí, sino en el componente App.js.
      */}
      <svg 
        className="h-6 w-6 text-white" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24" 
        xmlns="http://www.w3.org/2000/svg"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" 
        />
      </svg>
    </button>
   );
}
