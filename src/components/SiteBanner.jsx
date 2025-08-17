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
  const [isVisible, setIsVisible] = useState(true);
  const [isExiting, setIsExiting] = useState(false); // NUEVO: Estado para controlar la animación de salida.

  // ... (lógica de BACKEND_URL, API, parseMaybeJson no cambia)
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
          setIsVisible(true);
          setIsExiting(false); // Asegurarse de que no esté en estado de salida
          return;
        }
      } catch { /* intenta siguiente */ }
    }
    setCfg(null);
  };

  useEffect(() => { fetchBanner(); }, []);
  useEffect(() => {
    const handleBannerUpdate = (e) => {
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
        setIsVisible(true);
        setIsExiting(false);
      } else {
        setCfg(null);
      }
    };
    window.addEventListener('bannerUpdated', handleBannerUpdate);
    return () => window.removeEventListener('bannerUpdated', handleBannerUpdate);
  }, []);

  // NUEVO: Función para manejar el cierre con animación
  const handleClose = () => {
    setIsExiting(true); // Inicia la animación de salida
    setTimeout(() => {
      setIsVisible(false); // Oculta el componente después de la animación
    }, 300); // La duración debe coincidir con la animación CSS
  };

  if (!cfg || !cfg.enabled || !String(cfg.text || '').trim() || !isVisible) {
    return null;
  }

  const palette = {
    info:    { bg: 'rgba(59,130,246,0.12)',  bd: '#93c5fd', color: '#1d4ed8' },
    warn:    { bg: 'rgba(234,179,8,0.12)',   bd: '#fde68a', color: '#92400e' },
    alert:   { bg: 'rgba(239,68,68,0.12)',   bd: '#fecaca', color: '#991b1b' },
    success: { bg: 'rgba(34,197,94,0.12)',   bd: '#bbf7d0', color: '#14532d' },
  }[cfg.variant] || { bg: 'rgba(59,130,246,0.12)', bd: '#93c5fd', color: '#1d4ed8' };

  // MODIFICADO: Se añaden keyframes y clases para animación
  const styles = `
    @keyframes fadeInUp {
      from { opacity: 0; transform: translate(-50%, 20px); }
      to   { opacity: 1; transform: translate(-50%, 0); }
    }
    @keyframes fadeOutDown {
      from { opacity: 1; transform: translate(-50%, 0); }
      to   { opacity: 0; transform: translate(-50%, 20px); }
    }
    @media (min-width: 640px) {
      @keyframes fadeInUp {
        from { opacity: 0; transform: translateY(20px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes fadeOutDown {
        from { opacity: 1; transform: translateY(0); }
        to   { opacity: 0; transform: translateY(20px); }
      }
    }

    .site-banner {
      /* ... estilos base ... */
      position: fixed; bottom: 24px; z-index: 1000; display: flex; align-items: center;
      gap: 8px; padding: 6px 10px; border-radius: 8px; backdrop-filter: blur(2px);
      box-shadow: 0 2px 8px rgba(0,0,0,.08); background: ${palette.bg};
      border: 1px solid ${palette.bd}; color: ${palette.color}; font-size: 14px;
      line-height: 1.3;
      
      /* Animación de entrada */
      animation: fadeInUp 0.3s ease-out forwards;

      /* Estilos para pantallas pequeñas */
      left: 50%; transform: translateX(-50%); width: 90vw; max-width: 400px; justify-content: center;
    }
    .site-banner.exiting {
      animation: fadeOutDown 0.3s ease-in forwards;
    }

    @media (min-width: 640px) {
      .site-banner {
        left: 92px; transform: translateX(0); width: auto;
        max-width: calc(100vw - 92px - 24px); justify-content: flex-start;
      }
      .site-banner.exiting {
        /* Sobrescribe la animación de salida para pantallas grandes */
        animation: fadeOutDown 0.3s ease-in forwards;
      }
    }
  `;

  return (
    <>
      <style>{styles}</style>
      {/* MODIFICADO: Se añade la clase 'exiting' condicionalmente */}
      <div className={`site-banner ${isExiting ? 'exiting' : ''}`} role="status" aria-live="polite">
        <span style={{ fontWeight: 600 }}>INFORMA:</span>
        <span style={{ flexShrink: 1 }}>{cfg.text}</span>
        {cfg.link_href && cfg.link_text ? (
          <a href={cfg.link_href} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline', marginLeft: 8, whiteSpace: 'nowrap' }}>
            {cfg.link_text}
          </a>
        ) : null}
        {/* MODIFICADO: El botón ahora usa el componente SVG y llama a handleClose */}
        <button
          onClick={handleClose}
          aria-label="Cerrar banner"
          style={{
            background: 'none', border: 'none', color: 'inherit', cursor: 'pointer',
            padding: 0, marginLeft: '8px', opacity: 0.7, display: 'flex', alignItems: 'center'
          }}
        >
          <CloseIcon />
        </button>
      </div>
    </>
  );
}
