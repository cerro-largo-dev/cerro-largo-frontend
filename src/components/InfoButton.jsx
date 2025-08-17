import React, { forwardRef } from 'react';

const InfoButton = forwardRef(({ onClick, isOpen = false }, ref) => {
  return (
    <button
      ref={ref}
      onClick={onClick}
      className="w-14 h-14 bg-blue-300 hover:bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center focus:outline-none"
      title={isOpen ? "Cerrar información" : "Información"}
      aria-label={isOpen ? "Cerrar información" : "Información"}
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
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m0 0V11a1 1 0 011-1h2a1 1 0 011 1v10m3 0a1 1 0 001-1V10m0 0l2 2m-2-2l7-7"
          />
        </svg>
      )}
    </button>
  );
});

export default InfoButton;

