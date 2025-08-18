import React, { useEffect, useMemo, useState } from 'react';

// NUEVO: Componente para el ícono SVG de cierre.
// Usar `currentColor` para el `stroke` permite que herede el color del texto del padre.
const CloseIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

export default function SiteBanner() {
  const [cfg, setCfg] = useState(null);
  const [leftOffset, setLeftOffset] = useState(92);
  const [isVisible, setIsVisible] = useState(true); // NUEVO: Estado para el cierre

  const BACKEND_URL =
    (typeof window !== 'undefined' && window.BACKEND_URL) ||
    (typeof import.meta !== 'undefined' &&
      import.meta.env &&
      (import.meta.env.VITE_REACT_APP_BACKEND_URL || import.meta.env.VITE_BACKEND_URL)) ||
    (typeof process !== 'undefined' &&
      process.env &&
      (process.env.REACT_APP_BACKEND_URL || process.env.VITE_BACKEND_URL)) ||
    'https://cerro-largo-backend.onrender.com';

  const API = useMemo(( ) => {
    const base = String(BACKEND_URL || '').replace(/\/$/, '');
    return (p) => base + p;
  }, [BACKEND_URL]);

  const parseMaybeJson = async (res) => {
    const ct = res.headers.get('content-type') || '';
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
    if (!ct.includes('application/json')) throw new Error(`No-JSON: ${text.slice(0, 200)}`);
    try { return JSON.parse(text); } catch { return {}; }
  };

  const fetchBanner = async () => {
    for (const url of [API('/api/admin/banner'), API('/api/banner')]) {
      try {
        const res = await fetch(url, { credentials: 'include' });
        const data = await parseMaybeJson(res);
        if (data && data.enabled && String(data.text || '').trim()) {
          setCfg({
            enabled: !!data.enabled,
            text: String(data.text || ''),
            variant: String(data.variant || 'info').toLowerCase(),
            link_text: String(data.link_text || ''),
            link_href: String(data.link_href || ''),
            id: String(data.id || ''),
          });
          setIsVisible(true); // NUEVO: Mostrar banner al cargar
          return;
        }
      } catch { /* intenta siguiente */ }
    }
    setCfg(null);
  };

  // Offset dinámico en base al FAB (Lógica original sin cambios)
  useEffect(() => {
    const compute = () => {
      const fab = document.querySelector('.report-fab');
      const baseLeft = 24;
      const fabWidth = fab ? fab.offsetWidth : 56;
      const gap = 12;
      setLeftOffset(baseLeft + fabWidth + gap);
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, []);

  // Cargar banner + live update
  useEffect(() => { fetchBanner(); }, []);
  useEffect(() => {
    const h = (e) => {
      const b = e?.detail || {};
      if (b && b.enabled && String(b.text || '').trim()) {
        setCfg({
          enabled: !!b.enabled,
          text: String(b.text || ''),
          variant: String(b.variant || 'info').toLowerCase(),
          link_text: String(b.link_text || ''),
          link_href: String(b.link_href || ''),
          id: String(b.id || ''),
        });
        setIsVisible(true); // NUEVO: Mostrar banner al actualizar
      } else {
        setCfg(null);
      }
    };
    window.addEventListener('bannerUpdated', h);
    return () => window.removeEventListener('bannerUpdated', h);
  }, []);

  // MODIFICADO: La condición ahora también comprueba si el usuario lo cerró
  if (!cfg || !cfg.enabled || !String(cfg.text || '').trim() || !isVisible) {
    return null;
  }

  const palette =
    {
      info:    { bg: 'rgba(59,130,246,0.12)',  bd: '#93c5fd', color: '#1d4ed8' },
      warn:    { bg: 'rgba(234,179,8,0.12)',   bd: '#fde68a', color: '#92400e' },
      alert:   { bg: 'rgba(239,68,68,0.12)',   bd: '#fecaca', color: '#991b1b' },
      success: { bg: 'rgba(34,197,94,0.12)',   bd: '#bbf7d0', color: '#14532d' },
    }[cfg.variant] || { bg: 'rgba(59,130,246,0.12)', bd: '#93c5fd', color: '#1d4ed8' };

  const style = {
    position: 'fixed',
    bottom: 24,
    left: leftOffset,
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    maxWidth: `calc(100vw - ${leftOffset}px - 24px)`, // Se ajusta el cálculo de maxWidth
    padding: '6px 10px',
    borderRadius: 8,
    backdropFilter: 'blur(2px)',
    boxShadow: '0 2px 8px rgba(0,0,0,.08)',
    background: palette.bg,
    border: `1px solid ${palette.bd}`,
    color: palette.color,
    fontSize: 14,
    lineHeight: 1.3,
  };

  return (
    <div style={style} role="status" aria-live="polite">
      <span style={{ fontWeight: 600 }}>⚠ AVISO:</span>
      <span style={{ flexShrink: 1 }}>{cfg.text}</span>
      {cfg.link_href && cfg.link_text ? (
        <a href={cfg.link_href} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline', marginLeft: 8, whiteSpace: 'nowrap' }}>
          {cfg.link_text}
        </a>
      ) : null}
      {/* NUEVO: Botón de cierre con ícono SVG */}
      <button
        onClick={() => setIsVisible(false)}
        aria-label="Cerrar banner"
        style={{
          background: 'none',
          border: 'none',
          color: 'inherit',
          cursor: 'pointer',
          padding: 0,
          marginLeft: '8px',
          opacity: 0.7,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <CloseIcon />
      </button>
    </div>
  );
}
