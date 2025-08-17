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
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          <circle cx="12" cy="11" r="1" fill="currentColor" />
          <path d="M12 14v-2" strokeWidth="2.5" />
        </svg>
      )}
    </button>
  );
});

export default InfoButton;

