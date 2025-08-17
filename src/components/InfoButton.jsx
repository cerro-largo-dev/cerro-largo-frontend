import React, { forwardRef } from 'react';

const InfoButton = forwardRef(({ onClick }, ref) => {
  return (
    <button
      ref={ref}
      onClick={onClick}
      className="w-14 h-14 bg-blue-400 hover:bg-blue-500 text-white rounded-full shadow-lg flex items-center justify-center focus:outline-none"
      title="Información"
      aria-label="Información"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-6 w-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="12" cy="12" r="10" />
        <text
          x="12"
          y="16"
          textAnchor="middle"
          fontSize="12"
          fontWeight="bold"
          fill="currentColor"
          fontFamily="Arial, sans-serif"
        >
          i
        </text>
      </svg>
    </button>
  );
});

export default InfoButton;

