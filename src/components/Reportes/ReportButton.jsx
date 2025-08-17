import React, { useState, forwardRef } from 'react';

const ReportButton = forwardRef(({ onClick, onLocationChange }, ref) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleClick = () => {
    if (onClick) {
      onClick();
    }
    setIsModalOpen(prev => !prev);
  };

  return (
    <button
      ref={ref}
      onClick={handleClick}
      className="fixed bottom-4 left-4 h-14 w-14 rounded-full bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center border-none cursor-pointer report-fab z-[1000] safe-area-inset-bottom"
      style={{
        // Asegurar que el botón esté visible en pantallas móviles
        bottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))',
        left: 'max(1rem, env(safe-area-inset-left, 1rem))'
      }}
      aria-label="Crear un nuevo reporte"
      title="Crear Reporte"
    >
      {isModalOpen ? (
        <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      ) : (
        <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>
      )}
    </button>
  );
});

ReportButton.displayName = 'ReportButton';

export default ReportButton;

