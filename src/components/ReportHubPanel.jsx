import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';

/**
 * Panel “Reporte” (popover)
 * - Se abre DEBAJO del botón "Reporte" (arriba-derecha).
 * - Secciones:
 *    1) Descargar PDF → GET /api/report/download  (credentials:'include')
 *    2) Suscribirme   → POST /api/notify/subscribe (stub)
 * - Accesibilidad: role="dialog" aria-modal, cierra con Esc y click-outside,
 *   foco inicial en el input teléfono.
 *
 * Props:
 *  - open: boolean
 *  - anchorRect: DOMRect del botón al momento de abrir (para posicionar)
 *  - onClose: function()
 */
export default function ReportHubPanel({ open = false, anchorRect = null, onClose }) {
  // Backend URL (mismo patrón del proyecto)
  const BACKEND_URL =
    (typeof window !== 'undefined' && window.BACKEND_URL) ||
    (typeof import.meta !== 'undefined' &&
      import.meta.env &&
      (import.meta.env.VITE_REACT_APP_BACKEND_URL || import.meta.env.VITE_BACKEND_URL)) ||
    (typeof process !== 'undefined' &&
      process.env &&
      (process.env.REACT_APP_BACKEND_URL || process.env.VITE_BACKEND_URL)) ||
    'https://cerro-largo-backend.onrender.com';

  const API = useMemo(() => {
    const base = String(BACKEND_URL || '').replace(/\/$/, '');
    return (p) => base + p;
  }, [BACKEND_URL]);

  // Posicionamiento relativo al botón
  const panelRef = useRef(null);
  const phoneRef = useRef(null);
  const [stylePos, setStylePos] = useState({ top: 56, right: 12 }); // fallback

  const computePosition = useCallback(() => {
    if (!anchorRect) return;
    // Queremos alinear el borde derecho del panel con el del botón,
    // y situarlo un poco por debajo.
    const gap = 8;
    const top = Math.max(8, Math.round(anchorRect.bottom + gap));
    const right = Math.max(8, Math.round(window.innerWidth - anchorRect.right));
    setStylePos({ top, right });
  }, [anchorRect]);

  useEffect(() => {
    if (!open) return;
    computePosition();
    const onResize = () => computePosition();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, { passive: true });
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize);
    };
  }, [open, computePosition]);

  // Cerrar con Escape y click-outside
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    const onClickOutside = (e) => {
      if (!panelRef.current) return;
      if (!panelRef.current.contains(e.target)) onClose?.();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClickOutside);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClickOutside);
    };
  }, [open, onClose]);

  // Foco inicial
  useEffect(() => {
    if (open) {
      // pequeño delay para asegurar render
      const t = setTimeout(() => phoneRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  // ---------- Formulario de suscripción ----------
  const ZONE_ORDER = [
    'ACEGUÁ', 'FRAILE MUERTO', 'RÍO BRANCO', 'TUPAMBAÉ', 'LAS CAÑAS', 'ISIDORO NOBLÍA',
    'CERRO DE LAS CUENTAS', 'ARÉVALO', 'BAÑADO DE MEDINA', 'TRES ISLAS', 'LAGUNA MERÍN',
    'CENTURIÓN', 'RAMÓN TRIGO', 'ARBOLITO', 'QUEBRACHO', 'PLÁCIDO ROSAS',
    'Melo (GBA)', 'Melo (GBB)', 'Melo (GBC)', 'Melo (GCB)', 'Melo (GEB)'
  ];

  const [phone, setPhone] = useState('');
  const [zones, setZones] = useState([]);
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!open) {
      // reset suave al cerrar
      setSaving(false);
      setDownloading(false);
    }
  }, [open]);

  const E164 = /^\+?[1-9]\d{6,14}$/;

  const handleZonesChange = (e) => {
    const opts = Array.from(e.target.options || []);
    const selected = opts.filter((o) => o.selected).map((o) => o.value);
    setZones(selected);
  };

  const fetchJson = async (url, options = {}) => {
    const res = await fetch(url, { credentials: 'include', ...options });
    const ct = res.headers.get('content-type') || '';
    const text = await res.text();
    if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + res.statusText + ': ' + text.slice(0, 200));
    if (!ct.includes('application/json')) throw new Error('No-JSON: ' + text.slice(0, 200));
    return JSON.parse(text);
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await fetch(API('/api/report/download'), { method: 'GET', credentials: 'include' });
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error('HTTP ' + res.status + ': ' + t.slice(0, 200));
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reporte_camineria_cerro_largo_${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e) {
      alert('No se pudo descargar el reporte: ' + e.message);
    } finally {
      setDownloading(false);
    }
  };

  const handleSubscribe = async (e) => {
    e?.preventDefault?.();
    // Validaciones
    if (!E164.test(phone)) {
      alert('Teléfono inválido. Formato E.164 (ej: +598...).');
      phoneRef.current?.focus();
      return;
    }
    if (!Array.isArray(zones) || zones.length === 0) {
      alert('Selecciona al menos una zona.');
      return;
    }
    if (!consent) {
      alert('Debes aceptar el consentimiento para recibir avisos.');
      return;
    }

    setSaving(true);
    try {
      const body = { phone, zones, consent: true };
      const resp = await fetchJson(API('/api/notify/subscribe'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!resp?.success) throw new Error(resp?.message || 'No se pudo guardar la suscripción');
      alert('Recibido, te avisamos cuando habilitemos WhatsApp.');
      // limpia parcialmente
      setConsent(false);
    } catch (e2) {
      alert('No se pudo guardar, reintente. ' + e2.message);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div
      id="report-hub-panel"
      role="dialog"
      aria-modal="true"
      aria-label="Panel de Reporte"
      ref={panelRef}
      className="fixed z-[1001] w-[92vw] max-w-[360px] rounded-xl shadow-lg bg-white/95 backdrop-blur border border-gray-200"
      style={{ top: stylePos.top, right: stylePos.right }}
    >
      {/* Encabezado */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold">R</span>
          <h3 className="font-semibold text-gray-800">Reporte</h3>
        </div>
        <button
          onClick={onClose}
          aria-label="Cerrar panel"
          className="p-1 rounded hover:bg-gray-100"
        >
          <svg className="h-5 w-5 text-gray-600" viewBox="0 0 24 24" stroke="currentColor" fill="none">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Contenido */}
      <div className="p-4 space-y-4">
        {/* Sección: Descargar PDF */}
        <section className="rounded-lg border border-gray-200 p-3">
          <h4 className="text-sm font-medium text-gray-800 mb-2">Descargar PDF</h4>
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className={[
              'px-3 py-2 rounded-md text-white font-medium',
              downloading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700',
              'shadow-sm'
            ].join(' ')}
          >
            {downloading ? 'Generando…' : 'Descargar reporte'}
          </button>
        </section>

        {/* Sección: Suscribirme */}
        <section className="rounded-lg border border-gray-200 p-3">
          <h4 className="text-sm font-medium text-gray-800 mb-3">Suscribirme a alertas</h4>

          <form onSubmit={handleSubscribe} className="space-y-3">
            {/* Teléfono */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-600" htmlFor="sub-phone">Teléfono (E.164)</label>
              <input
                id="sub-phone"
                ref={phoneRef}
                type="tel"
                inputMode="tel"
                placeholder="+598..."
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-[11px] text-gray-500">Formato: +598…</span>
            </div>

            {/* Zonas (múltiple) */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-600" htmlFor="sub-zones">Zonas / Municipios</label>
              <select
                id="sub-zones"
                multiple
                value={zones}
                onChange={handleZonesChange}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 h-28"
              >
                {ZONE_ORDER.map((z) => (
                  <option key={z} value={z}>{z}</option>
                ))}
              </select>
              <span className="text-[11px] text-gray-500">Seleccioná una o más zonas (Ctrl/Cmd para multi-selección).</span>
            </div>

            {/* Consentimiento */}
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="accent-blue-600"
              />
              <span>Acepto recibir avisos por WhatsApp.</span>
            </label>

            {/* Acciones */}
            <div className="pt-1 flex items-center gap-8">
              <button
                type="submit"
                disabled={saving}
                className={[
                  'px-3 py-2 rounded-md text-white font-medium',
                  saving ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700',
                  'shadow-sm'
                ].join(' ')}
              >
                {saving ? 'Guardando…' : 'Guardar'}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="text-sm text-gray-600 hover:text-gray-800"
              >
                Cancelar
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
