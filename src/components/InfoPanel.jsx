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
      className="fixed z-[999] bg-white/95 backdrop-blur w-[300px] max-w-[90vw] rounded-xl border border-gray-200 shadow-lg"
      style={{ bottom: stylePos.bottom, left: stylePos.left }}
    >
      {/* Cabecera del panel */}
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

      {/* Contenido del panel con acordeones */}
      <div className="p-3 text-sm space-y-2 text-gray-800">
        {/* Acordeón 1: Beneficios */}
        <div className="collapse collapse-plus bg-base-100 border border-base-300">
          <input type="radio" name="info-accordion" defaultChecked />
          <div className="collapse-title font-semibold">1. Beneficios y Seguridad</div>
          <div className="collapse-content text-sm">
            <ul className="list-disc list-inside">
              <li>Mejora conectividad rural y seguridad vial.</li>
              <li>Reduce costos logísticos y prevenís cortes.</li>
              <li>Optimiza planificación entre sectores productivos.</li>
            </ul>
          </div>
        </div>

        {/* Acordeón 2: Funcionamiento */}
        <div className="collapse collapse-plus bg-base-100 border border-base-300">
          <input type="radio" name="info-accordion" />
          <div className="collapse-title font-semibold">2. Cómo Funciona</div>
          <div className="collapse-content text-sm">
            <ul className="list-disc list-inside">
              <li>Reportes ciudadanos de caminos.</li>
              <li>Pluviómetros e integración automática.</li>
              <li>Alertas por color: verde, amarillo, rojo.</li>
              <li>Administrador puede validar o anular alertas.</li>
            </ul>
          </div>
        </div>

        {/* Acordeón 3: Pluviometría */}
        <div className="collapse collapse-plus bg-base-100 border border-base-300">
          <input type="radio" name="info-accordion" />
          <div className="collapse-title font-semibold">3. Pluviometría y Alertas</div>
          <div className="collapse-content text-sm">
            <ul className="list-disc list-inside">
              <li>Verde = habilitado; Amarillo = precaución (2–5 mm/h); Rojo = cierre (&gt;5 mm/h).</li>
              <li>Acumulados 48 h avalan cierres automáticos.</li>
              <li>Sin lluvias 12 h → se desactiva alerta.</li>
            </ul>
          </div>
        </div>

        {/* Acordeón 4: Instituciones */}
        <div className="collapse collapse-plus bg-base-100 border border-base-300">
          <input type="radio" name="info-accordion" />
          <div className="collapse-title font-semibold">4. Instituciones y Alianzas</div>
          <div className="collapse-content text-sm">
            <ul className="list-disc list-inside">
              <li>Gobierno Departamental de Cerro Largo.</li>
              <li>INUMET – Datos y soporte técnico.</li>
              <li>Productores agropecuarios.</li>
              <li>UPM / LUMIN / MINERVA / COLEME / ACA.</li>
              <li>Transportistas &amp; camioneros.</li>
              <li>MTOP / OPP / FDI (apoyo institucional).</li>
            </ul>
          </div>
        </div>

        {/* Acordeón 5: Contacto */}
        <div className="collapse collapse-plus bg-base-100 border border-base-300">
          <input type="radio" name="info-accordion" />
          <div className="collapse-title font-semibold">5. Contacto – Intendencia de Cerro Largo</div>
          <div className="collapse-content text-sm">
            <div className="space-y-1">
              <p><strong>Dirección:</strong> General Justino Muniz 591, Melo.</p>
              <p><strong>Teléfonos:</strong> +598 4642 6551 al 58</p>
              <p><strong>Facebook:</strong> Gobierno de Cerro Largo</p>
            </div>
          </div>
        </div>

        {/* Pie con logos */}
        <div className="pt-2 border-t flex justify-center">
          <img src="/logocerrolargo.webp" alt="Logo del Gobierno de Cerro Largo" className="h-10" />
        </div>
      </div>
    </div>
  );
}
