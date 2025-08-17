import React, { forwardRef } from 'react';

const InfoButton = forwardRef(({ onClick }, ref) => {
  return (
    <button
      ref={ref}
      onClick={onClick}
      className="w-14 h-14 bg-blue-400 hover:bg-blue-500 text-white rounded-full shadow-lg flex items-center justify-center focus:outline-none"
      title="Inicio / Información"
      aria-label="Inicio / Información"
    >
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
    </button>
  );
});

export default InfoButton;

