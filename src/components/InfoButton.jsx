import React, { useState, forwardRef } from 'react';

const InfoButton = forwardRef(({ onClick }, ref) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleClick = () => {
    if (onClick) {
      onClick();
    }
    setIsOpen(prev => !prev);
  };

  return (
    <button
      ref={ref}
      onClick={handleClick}
      className="w-14 h-14 bg-blue-400 hover:bg-blue-500 text-white rounded-full shadow-lg flex items-center justify-center focus:outline-none transition-colors duration-200"
      title={isOpen ? "Cerrar información" : "Información"}
      aria-label={isOpen ? "Cerrar información" : "Información"}
    >
      {isOpen ? (
        // Icono X para cerrar
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      ) : (
        // Icono de casa estilo Instagram (contorno limpio)
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
          />
          <polyline 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            points="9,22 9,12 15,12 15,22"
          />
        </svg>
      )}
    </button>
  );
});

InfoButton.displayName = 'InfoButton';

export default InfoButton;

