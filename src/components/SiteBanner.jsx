// src/components/SiteBanner.jsx
import React, { useEffect, useMemo, useState } from 'react';

const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

export default function SiteBanner() {
  const [cfg, setCfg] = useState(null);
  const [leftOffset, setLeftOffset] = useState(92);
  const [isVisible, setIsVisible] = useState(false);

  const BACKEND_URL =
    (typeof window !== 'undefined' && window.BACKEND_URL) ||
    (typeof import.meta !== 'undefined' && import.meta.env &&
      (import.meta.env.VITE_REACT_APP_BACKEND_URL || import.meta.env.VITE_BACKEND_URL)) ||
    (typeof process !== 'undefined' && process.env &&
      (process.env.REACT_APP_BACKEND_URL || process.env.VITE_BACKEND_URL)) ||
    'https://cerro-largo-backend.onrender.com';

  const API = useMemo(() => {
    const base = String(BACKEND_URL || '').replace(/\/$/, '');
    return (p) => base + p;
  }, [BACKEND_URL]);

  const parseMaybeJson = async (res) => {
    const ct = res.headers.get('content-type') || '';
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 180)}`);
    if (!ct.includes('application/json')) throw new Error(`No-JSON: ${text.slice(0, 180)}`);
    try { return JSON.parse(text); } catch { return {}; }
  };

  const storageKey = (meta) => {
    const ver = (meta?.updated_at || '') + '|' + (meta?.text || '');
    return `siteBannerHidden:${ver}`;
  };

  const applyBanner = (data) => {
    const enabled = !!data?.enabled;
    const text = String(data?.text || '').trim();
    if (!enabled || !text) {
      setCfg(null);
      setIsVisible(false);
      return;
    }
    const next = {
      enabled,
      text,
      variant: String(data?.variant || 'info').toLowerCase(),
      link_text: String(data?.link_text || ''),
      link_href: String(data?.link_href || ''),
      id: String(data?.id || '1'),
      updated_at: String(data?.updated_at || ''),
    };
    setCfg(next);

    // Si este banner se cerró (esta versión exacta), no lo muestres.
    const key = storageKey(next);
    const hidden = localStorage.getItem(key) === '1';
    setIsVisible(!hidden);
  };

  const fetchBanner = async () => {
    try {
      const res = await fetch(API('/api/banner'), { credentials: 'include', cache: 'no-store' });
      const data = await parseMaybeJson(res);
      applyBanner(data);
    } catch (e) {
      // Si hay error de red, no cambies el estado actual; evitás “parpadeos”
      // console.warn('Banner fetch error:', e);
    }
  };

  // Posición en función del FAB
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

  // Carga inicial + refresco periódico
  useEffect(() => {
    fetchBanner();
    const t = setInterval(fetchBanner, 120000); // 2 minutos
    return () => clearInterval(t);
  }, []); // eslint-disable-line

  // Live-update opcional desde el admin (ignora payloads inválidos)
  useEffect(() => {
    const h = (e) => {
      const b = e?.detail;
      if (b && b.enabled && String(b.text || '').trim()) applyBanner(b);
      // si viene inválido, lo ignoramos (NO ocultamos el banner existente)
    };
    window.addEventListener('bannerUpdated', h);
    return () => window.removeEventListener('bannerUpdated', h);
  }, []);

  if (!cfg || !isVisible) return null;

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
    maxWidth: `calc(100vw - ${leftOffset}px - 24px)`,
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

  const onClose = () => {
    const key = storageKey(cfg);
    localStorage.setItem(key, '1');  // recuerda cierre de ESTA versión
    setIsVisible(false);
  };

  return (
    <div style={style} role="status" aria-live="polite">
      <span style={{ fontWeight: 600 }}>AVISO:</span>
      <span style={{ flexShrink: 1 }}>{cfg.text}</span>
      {cfg.link_href && cfg.link_text ? (
        <a href={cfg.link_href} target="_blank" rel="noreferrer"
           style={{ textDecoration: 'underline', marginLeft: 8, whiteSpace: 'nowrap' }}>
          {cfg.link_text}
        </a>
      ) : null}
      <button onClick={onClose} aria-label="Cerrar banner"
        style={{ background: 'none', border: 'none', color: 'inherit',
                 cursor: 'pointer', padding: 0, marginLeft: '8px',
                 opacity: 0.7, display: 'flex', alignItems: 'center' }}>
        <CloseIcon />
      </button>
    </div>
  );
}
