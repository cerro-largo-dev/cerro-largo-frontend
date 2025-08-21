import React, { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Componente InfoPanel que muestra información en un panel flotante.
 * @param {object} props
 * @param {boolean} props.open - Controla si el panel está visible.
 * @param {DOMRect} props.anchorRect - La posición del botón que ancla el panel.
 * @param {Function} props.onClose - Función para cerrar el panel.
 * @param {React.RefObject} props.buttonRef - Referencia al botón que abre/cierra el panel.
 */
export default function InfoPanel({ open = false, anchorRect = null, onClose, buttonRef }) {
  const panelRef = useRef(null);
  const [stylePos, setStylePos] = useState({ bottom: 84, left: 16 }); // Posición de fallback
  const [openAccordion, setOpenAccordion] = useState(null); // Controla qué acordeón está abierto

  // Función para manejar la apertura/cierre de los acordeones internos
  const toggleAccordion = (accordionId) => {
    setOpenAccordion(openAccordion === accordionId ? null : accordionId);
  };

  // Calcula la posición del panel al costado derecho del botón de anclaje
  const computePos = useCallback(() => {
    if (!anchorRect) return;
    const gap = 12; // Espacio entre el botón y el panel
    const left = Math.round(anchorRect.right + gap);
    const bottom = Math.round(window.innerHeight - anchorRect.bottom);
    setStylePos({ left, bottom });
  }, [anchorRect]);

  // Efecto para recalcular la posición cuando el panel se abre o la ventana cambia de tamaño
  useEffect(() => {
    if (!open) return;
    computePos();
    const onResize = () => computePos();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, { passive: true });
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize);
    };
  }, [open, computePos]);

  // Efecto para manejar el cierre del panel (tecla Escape y clic fuera)
  useEffect(() => {
    if (!open) return;

    // Cierra con la tecla 'Escape'
    const onKey = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };

    // Cierra al hacer clic fuera del panel Y fuera del botón que lo abre
    const onClickOutside = (e) => {
      // Si el clic fue dentro del panel, no hagas nada
      if (panelRef.current && panelRef.current.contains(e.target)) {
        return;
      }
      // Si el clic fue en el botón que abre el panel, no hagas nada
      if (buttonRef?.current && buttonRef.current.contains(e.target)) {
        return;
      }
      // Si el clic fue en cualquier otro lugar, cierra el panel
      onClose?.();
    };

    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClickOutside); // Usar mousedown para capturar el evento antes que otros 'click'

    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClickOutside);
    };
  }, [open, onClose, buttonRef]); // Dependencias del efecto

  // Si el panel no está abierto, no renderizar nada
  if (!open) {
    return null;
  }

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label="Información"
      className="fixed z-[999] bg-white/95 backdrop-blur w-[300px] max-w-[90vw] rounded-xl border border-gray-200 shadow-lg"
      style={{ bottom: stylePos.bottom, left: stylePos.left }}
    >
      {/* Cabecera del panel */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-800">Caminos que Conectan</h3>
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

      {/* Contenido del panel con acordeones */}
      <div className="p-3 text-sm space-y-2 text-gray-800">
        {/* Acordeón 1: Beneficios */}
        <div className="border rounded-md">
          <button 
            className="w-full px-3 py-2 font-semibold cursor-pointer text-left flex justify-between items-center hover:bg-gray-50"
            onClick={() => toggleAccordion('beneficios')}
            aria-expanded={openAccordion === 'beneficios'}
          >
            1. Beneficios y Seguridad
            <svg 
              className={`h-4 w-4 transition-transform ${openAccordion === 'beneficios' ? 'rotate-180' : ''}`} 
              viewBox="0 0 24 24" fill="none" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {openAccordion === 'beneficios' && (
            <div className="px-3 pb-3">
              <ul className="list-disc list-inside">
                <li>Mejora conectividad rural y seguridad vial.</li>
                <li>Reduce costos logísticos y prevenís cortes.</li>
                <li>Optimiza planificación.</li>
              </ul>
            </div>
          )}
        </div>

        {/* Acordeón 2: Funcionamiento */}
        <div className="border rounded-md">
          <button 
            className="w-full px-3 py-2 font-semibold  cursor-pointer text-left flex justify-between items-center hover:bg-gray-50"
            onClick={() => toggleAccordion('funcionamiento')}
            aria-expanded={openAccordion === 'funcionamiento'}
          >
            2. Cómo Funciona
            <svg 
              className={`h-4 w-4 transition-transform ${openAccordion === 'funcionamiento' ? 'rotate-180' : ''}`} 
              viewBox="0 0 24 24" fill="none" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {openAccordion === 'funcionamiento' && (
            <div className="px-4 pb-3">
              <ul className="list-disc list-inside">
                <li>Descargas alertas en PDF.</li>
                <li>Realizar denuncias y cortes.</li>
                 <li>Suscribirte por Whatshapp.</li>
                  <li>AVISOS a la comunidad.</li>
                 <li>Visualizar cortes - roturas - accidentes.</li>
              </ul>
            </div>
          )}
        </div>

        {/* Acordeón 3: Pluviometría */}
        <div className="border rounded-md">
          <button 
            className="w-full px-3 py-2 font-semibold  cursor-pointer text-left flex justify-between items-center hover:bg-gray-50"
            onClick={() => toggleAccordion('pluviometria')}
            aria-expanded={openAccordion === 'pluviometria'}
          >
            3. Pluviometría y Alertas
            <svg 
              className={`h-4 w-4 transition-transform ${openAccordion === 'pluviometria' ? 'rotate-180' : ''}`} 
              viewBox="0 0 24 24" fill="none" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {openAccordion === 'pluviometria' && (
            <div className="px-4 pb-3">
              <ul className="list-disc list-inside">
                <li>Verde = habilitado; Amarillo = precaución (2–5 mm/h); Rojo = cierre (&gt;5 mm/h).</li>
                <li>Sin lluvias 6 h → se desactiva alerta.</li>
              </ul>
            </div>
          )}
        </div>

        {/* Acordeón 4: Instituciones */}
        <div className="border rounded-md">
          <button 
            className="w-full px-3 py-2 font-semibold  cursor-pointer text-left flex justify-between items-center hover:bg-gray-50"
            onClick={() => toggleAccordion('instituciones')}
            aria-expanded={openAccordion === 'instituciones'}
          >
            4. Instituciones y Alianzas
            <svg 
              className={`h-4 w-4 transition-transform ${openAccordion === 'instituciones' ? 'rotate-180' : ''}`} 
              viewBox="0 0 24 24" fill="none" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {openAccordion === 'instituciones' && (
            <div className="px-4 pb-3">
              <ul className="list-disc list-inside">
                <li>Gobierno de Cerro Largo.</li>
                <li>INUMET – Datos y Soporte.</li>
                <li>Productores Agropecuarios.</li>
                <li>Transportistas y camioneros.</li>
                <li>MINERVA / UPM / LUMIN / COLEME / ACA.</li>
                <li>MTOP / OPP / FDI .</li>
              </ul>
            </div>
          )}
        </div>

        {/* Acordeón 5: Contacto */}
        <div className="border rounded-md">
          <button 
            className="w-full px-3 py-2 font-semibold  cursor-pointer text-left flex justify-between items-center hover:bg-gray-50"
            onClick={() => toggleAccordion('contacto')}
            aria-expanded={openAccordion === 'contacto'}
          >
            5. Contacto – Gobierno de Cerro Largo
            <svg 
              className={`h-4 w-4 transition-transform ${openAccordion === 'contacto' ? 'rotate-180' : ''}`} 
              viewBox="0 0 24 24" fill="none" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {openAccordion === 'contacto' && (
            <div className="px-4 pb-3 space-y-1">
              <p><strong>Dirección:</strong> General Justino Muniz 591, Melo.</p>
              <p><strong>Teléfonos:</strong> +598 4642 6551 al 58</p>
              <p><strong>Facebook:</strong> Gobierno de Cerro Largo</p>
            </div>
          )}
        </div>

        {/* Pie con logos */}
        <div className="pt-2 border-t flex justify-center">
          <img src="/gobcerro.png" alt="Logo del Gobierno de Cerro Largo" className="h-10" />
        </div>
      </div>
    </div>
  );
}
