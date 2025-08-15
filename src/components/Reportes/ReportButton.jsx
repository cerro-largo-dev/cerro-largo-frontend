import { useState } from 'react';
import ReportModal from './ReportModal.jsx';

export default function ReportButton({ onLocationChange, onEnsureLocation }) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleToggleModal = () => {
    setIsModalOpen((prev) => {
      const next = !prev;
      if (next && typeof onEnsureLocation === 'function') onEnsureLocation();
      return next;
    });
  };

  return (
    <>
      {/* Botón flotante */}
      <div className="fixed bottom-6 left-6 z-[999] report-fab">
        <button
          onClick={handleToggleModal}
          className="h-14 w-14 rounded-full bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center border-none cursor-pointer"
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
      </div>

      {/* Modal del formulario */}
      <ReportModal
        isOpen={isModalOpen}
        onClose={handleToggleModal}
        onLocationChange={onLocationChange}
      />
    </>
  );
}
