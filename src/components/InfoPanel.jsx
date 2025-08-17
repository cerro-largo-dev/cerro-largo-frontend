import React, { useEffect, useRef, useState, useCallback } from 'react';

export default function InfoPanel({ open=false, anchorRect=null, onClose }) {
  const panelRef = useRef(null);
  const [stylePos, setStylePos] = useState({ bottom: 84, left: 16 }); // fallback
  const [openAccordion, setOpenAccordion] = useState(null); // Estado para controlar qué acordeón está abierto

  // Función para manejar la apertura/cierre de acordeones
  const toggleAccordion = (accordionId) => {
    setOpenAccordion(openAccordion === accordionId ? null : accordionId);
  };

  // Posición → al costado derecho del botón
  const computePos = useCallback(() => {
    if (!anchorRect) return;
    const gap = 12;
    const left = Math.round(anchorRect.right + gap);
    const bottom = Math.round(window.innerHeight - anchorRect.bottom);
    setStylePos({ left, bottom });
  }, [anchorRect]);

  useEffect(() => {
    if (!open) return;
    computePos();
    const onResize = () => computePos();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, { passive:true });
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize);
    };
  }, [open, computePos]);

  // Escape + click-outside
  useEffect(() => {
    if (!open) return;
    const onKey = e => { if (e.key === 'Escape') onClose?.(); };
    const onClickO = e => {
      if (!panelRef.current) return;
      if (!panelRef.current.contains(e.target)) onClose?.();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClickO);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClickO);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label="Información"
      className="fixed z-[999] bg-white/95 backdrop-blur w-[300px] max-w-[90vw] rounded-xl border border-gray-200 shadow-lg"
      style={{ bottom: stylePos.bottom, left: stylePos.left }}
    >
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-800">Información</h3>
          <p className="text-xs text-gray-600 mt-1">Plataforma digital que permite monitorear, reportar y gestionar en tiempo real el estado de los caminos rurales.</p>
        </div>
        <button
          aria-label="Cerrar"
          className="p-1 rounded hover:bg-gray-100"
          onClick={() => onClose?.()}
        >
          <svg className="h-5 w-5 text-gray-600" viewBox="0 0 24 24" stroke="currentColor" fill="none">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="p-3 text-sm space-y-2 text-gray-800">
        <div className="border rounded-md">
          <button 
            className="w-full px-3 py-2 font-medium cursor-pointer text-left flex justify-between items-center hover:bg-gray-50"
            onClick={() => toggleAccordion('beneficios')}
          >
            1. Beneficios y Seguridad
            <svg 
              className={`h-4 w-4 transition-transform ${openAccordion === 'beneficios' ? 'rotate-180' : ''}`} 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {openAccordion === 'beneficios' && (
            <ul className="list-disc list-inside px-4 pb-3">
              <li>Mejora conectividad rural y seguridad vial.</li>
              <li>Reduce costos logísticos y prevenís cortes.</li>
              <li>Optimiza planificación entre sectores productivos.</li>
            </ul>
          )}
        </div>

        <div className="border rounded-md">
          <button 
            className="w-full px-3 py-2 font-medium cursor-pointer text-left flex justify-between items-center hover:bg-gray-50"
            onClick={() => toggleAccordion('funcionamiento')}
          >
            2. Cómo Funciona
            <svg 
              className={`h-4 w-4 transition-transform ${openAccordion === 'funcionamiento' ? 'rotate-180' : ''}`} 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {openAccordion === 'funcionamiento' && (
            <ul className="list-disc list-inside px-4 pb-3">
              <li>Reportes ciudadanos de caminos.</li>
              <li>Pluviómetros e integración automática.</li>
              <li>Alertas por color: verde, amarillo, rojo.</li>
              <li>Administrador puede validar o anular alertas.</li>
            </ul>
          )}
        </div>

        <div className="border rounded-md">
          <button 
            className="w-full px-3 py-2 font-medium cursor-pointer text-left flex justify-between items-center hover:bg-gray-50"
            onClick={() => toggleAccordion('pluviometria')}
          >
            3. Pluviometría y Alertas
            <svg 
              className={`h-4 w-4 transition-transform ${openAccordion === 'pluviometria' ? 'rotate-180' : ''}`} 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {openAccordion === 'pluviometria' && (
            <ul className="list-disc list-inside px-4 pb-3">
              <li>Verde = habilitado; Amarillo = precaución (2–5 mm/h); Rojo = cierre (&gt;5 mm/h).</li>
              <li>Acumulados 48 h avalan cierres automáticos.</li>
              <li>Sin lluvias 12 h → se desactiva alerta.</li>
            </ul>
          )}
        </div>

        <div className="border rounded-md">
          <button 
            className="w-full px-3 py-2 font-medium cursor-pointer text-left flex justify-between items-center hover:bg-gray-50"
            onClick={() => toggleAccordion('instituciones')}
          >
            4. Instituciones y Alianzas
            <svg 
              className={`h-4 w-4 transition-transform ${openAccordion === 'instituciones' ? 'rotate-180' : ''}`} 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {openAccordion === 'instituciones' && (
            <ul className="list-disc list-inside px-4 pb-3">
              <li>Gobierno Departamental de Cerro Largo.</li>
              <li>INUMET – Datos y soporte técnico.</li>
              <li>Productores agropecuarios.</li>
              <li>UPM / LUMIN / MINERVA / COLEME / ACA.</li>
              <li>Transportistas &amp; camioneros.</li>
              <li>MTOP / OPP / FDI (apoyo institucional).</li>
            </ul>
          )}
        </div>

        <div className="border rounded-md">
          <button 
            className="w-full px-3 py-2 font-medium cursor-pointer text-left flex justify-between items-center hover:bg-gray-50"
            onClick={() => toggleAccordion('contacto')}
          >
            5. Contacto – Intendencia de Cerro Largo
            <svg 
              className={`h-4 w-4 transition-transform ${openAccordion === 'contacto' ? 'rotate-180' : ''}`} 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {openAccordion === 'contacto' && (
            <div className="px-4 pb-3">
              <p><strong>Dirección:</strong> General Justino Muniz 591, Melo.</p>
              <p><strong>Teléfonos:</strong> +598 4642 6551 al 58</p>
              <p><strong>Facebook:</strong> Gobierno de Cerro Largo</p>
            </div>
          )}
        </div>

        {/* Pie con logos */}
        <div className="pt-2 border-t flex justify-center">
          <img src="/gobcerro.png" alt="Gob Cerro Largo" className="h-10" />
        </div>
      </div>
    </div>
  );
}
