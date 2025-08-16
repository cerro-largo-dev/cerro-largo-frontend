import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';

export default function ReportHubPanel({ open = false, anchorRect = null, onClose }) {
  // Backend URL (respeta tu env y window.BACKEND_URL)
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

  // Posicionamiento relativo al botón (popover)
  const panelRef = useRef(null);
  const phoneRef = useRef(null);
  const [stylePos, setStylePos] = useState({ top: 56, right: 12 }); // fallback

  const computePosition = useCallback(() => {
    if (!anchorRect) return;
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
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
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

  // Foco inicial en teléfono
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => phoneRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [open]);

  // ---------- Formulario ----------
  const ZONE_ORDER = [
    'ACEGUÁ','FRAILE MUERTO','RÍO BRANCO','TUPAMBAÉ','LAS CAÑAS','ISIDORO NOBLÍA','CERRO DE LAS CUENTAS',
    'ARÉVALO','BAÑADO DE MEDINA','TRES ISLAS','LAGUNA MERÍN','CENTURIÓN','RAMÓN TRIGO','ARBOLITO',
    'QUEBRACHO','PLÁCIDO ROSAS','Melo (GBA)','Melo (GBB)','Melo (GBC)','Melo (GCB)','Melo (GEB)'
  ];

  const [phone, setPhone] = useState('');
  const [zones, setZones] = useState([]);       // seleccionadas
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // “Seleccionar todo” (tri-estado)
  const allRef = useRef(null);
  const allChecked = zones.length === ZONE_ORDER.length;
  const noneChecked = zones.length === 0;
  useEffect(() => {
    if (allRef.current) allRef.current.indeterminate = !allChecked && !noneChecked;
  }, [allChecked, noneChecked]);

  const toggleAll = () => setZones(allChecked ? [] : ZONE_ORDER.slice());
  const toggleZone = (z) => {
    setZones((prev) => (prev.includes(z) ? prev.filter((x) => x !== z) : [...prev, z]));
  };

  // Validaciones/IO
  const E164 = /^\+?[1-9]\d{6,14}$/;

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
    if (!E164.test(phone)) {
      alert('Teléfono inválido. Formato E.164 (ej: +598…).');
      phoneRef.current?.focus();
      return;
    }
    if (zones.length === 0) {
      alert('Seleccioná al menos una zona.');
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
      className="fixed z-[1001] w-[90vw] max-w-[340px] rounded-xl shadow-lg bg-white/95 backdrop-blur border border-gray-200"
      style={{ top: stylePos.top, right: stylePos.right }}
    >
      {/* Encabezado */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold">R</span>
          <h3 className="font-semibold text-gray-800">Reporte</h3>
        </div>
        <button onClick={onClose} aria-label="Cerrar panel" className="p-1 rounded hover:bg-gray-100">
          <svg className="h-5 w-5 text-gray-600" viewBox="0 0 24 24" stroke="currentColor" fill="none">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Contenido */}
      <div className="p-3 space-y-3">
        {/* Sección: Descargar PDF — sin título, texto breve a la derecha */}
        <section className="rounded-lg border border-gray-200 p-2">
          <div className="flex items-center gap-3">
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
              {downloading ? 'Generando…' : 'Descargar PDF'}
            </button>
            <p className="text-[12px] leading-4 text-gray-600">
              Descargar PDF sobre los estados de alerta de Cerro Largo.
            </p>
          </div>
        </section>

        {/* Sección: Suscribirme */}
        <section className="rounded-lg border border-gray-200 p-2">
          <h4 className="text-sm font-medium text-gray-800 mb-2">Suscribirme a alertas por WhatsApp</h4>

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

            {/* ZONAS — checkboxes con “Seleccionar todo” (lista más chica) */}
            <div className="flex flex-col gap-2">
              <label className="text-xs text-gray-600">Zonas / Municipios</label>

              <label className="flex items-center gap-2 px-3 py-2 rounded-md bg-gray-50 border border-gray-200">
                <input
                  ref={allRef}
                  type="checkbox"
                  className="accent-blue-600"
                  checked={allChecked}
                  onChange={toggleAll}
                />
                <span className="text-sm text-gray-800 select-none">Seleccionar todas</span>
              </label>

              {/* ↓↓↓ Altura reducida */}
              <div className="max-h-36 overflow-auto pr-1 rounded-md border border-gray-200">
                <ul className="divide-y divide-gray-100">
                  {ZONE_ORDER.map((z) => {
                    const checked = zones.includes(z);
                    return (
                      <li key={z} className="flex items-center gap-2 px-3 py-1.5">
                        <input
                          id={`zone-${z}`}
                          type="checkbox"
                          className="accent-blue-600"
                          checked={checked}
                          onChange={() => toggleZone(z)}
                        />
                        <label htmlFor={`zone-${z}`} className="text-sm text-gray-800 select-none flex-1">
                          {z}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <span className="text-[11px] text-gray-500">Elegí con un clic. “Seleccionar todas” marca/desmarca todo.</span>
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

              <button type="button" onClick={onClose} className="text-sm text-gray-600 hover:text-gray-800">
                Cancelar
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}

