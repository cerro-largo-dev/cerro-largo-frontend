import React, { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Datos para los acordeones del panel de información.
 * Se definen fuera del componente para evitar que se redeclaren en cada render.
 */
const accordionData = [
  {
    id: 'beneficios',
    title: '1. Beneficios y Seguridad',
    content: (
      <ul className="list-disc list-inside space-y-1">
        <li>Mejora conectividad rural y seguridad vial.</li>
        <li>Reduce costos logísticos y previene cortes.</li>
        <li>Optimiza planificación entre sectores productivos.</li>
      </ul>
    ),
  },
  {
    id: 'funcionamiento',
    title: '2. Cómo Funciona',
    content: (
      <ul className="list-disc list-inside space-y-1">
        <li>Reportes ciudadanos de caminos.</li>
        <li>Pluviómetros e integración automática.</li>
        <li>Alertas por color: verde, amarillo, rojo.</li>
        <li>Administrador puede validar o anular alertas.</li>
      </ul>
    ),
  },
  {
    id: 'pluviometria',
    title: '3. Pluviometría y Alertas',
    content: (
      <ul className="list-disc list-inside space-y-1">
        <li>Verde = habilitado; Amarillo = precaución (2–5 mm/h); Rojo = cierre (&gt;5 mm/h).</li>
        <li>Acumulados 48 h avalan cierres automáticos.</li>
        <li>Sin lluvias por 12 h se desactiva la alerta.</li>
      </ul>
    ),
  },
  {
    id: 'instituciones',
    title: '4. Instituciones y Alianzas',
    content: (
      <ul className="list-disc list-inside space-y-1">
        <li>Gobierno Departamental de Cerro Largo.</li>
        <li>INUMET – Datos y soporte técnico.</li>
        <li>Productores agropecuarios.</li>
        <li>UPM / LUMIN / MINERVA / COLEME / ACA.</li>
        <li>Transportistas &amp; camioneros.</li>
        <li>MTOP / OPP / FDI (apoyo institucional).</li>
      </ul>
    ),
  },
  {
    id: 'contacto',
    title: '5. Contacto – Intendencia de Cerro Largo',
    content: (
      <div className="space-y-1">
        <p><strong>Dirección:</strong> General Justino Muniz 591, Melo.</p>
        <p><strong>Teléfonos:</strong> +598 4642 6551 al 58</p>
        <p><strong>Facebook:</strong> Gobierno de Cerro Largo</p>
      </div>
    ),
  },
];

/**
 * Componente InfoPanel que muestra información en un panel flotante con acordeones.
 * @param {object} props
 * @param {boolean} props.open - Controla si el panel está visible.
 * @param {DOMRect} props.anchorRect - La posición del botón que ancla el panel.
 * @param {Function} props.onClose - Función para cerrar el panel.
 * @param {React.RefObject} props.buttonRef - Referencia al botón que abre/cierra el panel.
 */
export default function InfoPanel({ open = false, anchorRect = null, onClose, buttonRef }) {
  const panelRef = useRef(null);
  const [stylePos, setStylePos] = useState({ bottom: 84, left: 16 });
  const [openAccordion, setOpenAccordion] = useState(accordionData[0].id); // El primer acordeón abierto por defecto

  // Función para manejar la apertura/cierre de los acordeones
  const toggleAccordion = (accordionId) => {
    setOpenAccordion(openAccordion === accordionId ? null : accordionId);
  };

  // Calcula la posición del panel al costado derecho del botón de anclaje
  const computePos = useCallback(() => {
    if (!anchorRect) return;
    const gap = 12;
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

    const onKey = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };

    const onClickOutside = (e) => {
      if (panelRef.current?.contains(e.target) || buttonRef.current?.contains(e.target)) {
        return;
      }
      onClose?.();
    };

    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClickOutside);

    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClickOutside);
    };
  }, [open, onClose, buttonRef]);

  if (!open) {
    return null;
  }

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label="Información"
      className="fixed z-[999] bg-white/95 backdrop-blur w-[320px] max-w-[90vw] rounded-xl border border-gray-200 shadow-lg flex flex-col"
      style={{ bottom: stylePos.bottom, left: stylePos.left }}
    >
      {/* Cabecera del panel */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-gray-800">Información</h3>
          <p className="text-xs text-gray-600 mt-1">Plataforma digital para monitorear el estado de los caminos rurales en tiempo real.</p>
        </div>
        <button
          aria-label="Cerrar"
          className="p-1 rounded-full hover:bg-gray-200 -mt-1 -mr-1"
          onClick={() => onClose?.()}
        >
          <svg className="h-5 w-5 text-gray-600" viewBox="0 0 24 24" stroke="currentColor" fill="none">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Contenido del panel con acordeones (con scroll si es necesario) */}
      <div className="p-3 space-y-2 overflow-y-auto">
        {accordionData.map((item) => (
          <div key={item.id} className="collapse collapse-plus bg-base-100 border border-base-300 rounded-md">
            {/* Este input es solo para el estilo visual, no se usa para la lógica */}
            <input
              type="checkbox"
              checked={openAccordion === item.id}
              onChange={() => toggleAccordion(item.id)}
              className="peer"
            />
            <div
              className="collapse-title font-semibold cursor-pointer"
              onClick={() => toggleAccordion(item.id)} // También se puede hacer clic aquí
            >
              {item.title}
            </div>
            <div className="collapse-content text-sm">
              {item.content}
            </div>
          </div>
        ))}

        {/* Pie con logos */}
        <div className="pt-3 mt-1 border-t flex justify-center">
          <img src="/gobcerro.png" alt="Logo del Gobierno de Cerro Largo" className="h-10" />
        </div>
      </div>
    </div>
  );
}
