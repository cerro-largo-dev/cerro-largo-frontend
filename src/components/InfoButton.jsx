import React, { forwardRef } from 'react';

const InfoButton = forwardRef(({ onClick, isOpen = false }, ref) => {
  return (
    <button
      ref={ref}
      onClick={onClick}
      className="w-14 h-14 bg-blue-300 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center focus:outline-none"
      title={isOpen ? "Cerrar información" : "Inicio / Información"}
      aria-label={isOpen ? "Cerrar información" : "Inicio / Información"}
    >
      {isOpen ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-7 w-7"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9,22 9,12 15,12 15,22" />
        </svg>
      )}
    </button>
  );
});

export default InfoButton;

