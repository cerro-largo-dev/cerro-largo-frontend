// src/hooks/useAuth.jsx
import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { authAPI, authenticatedFetch } from '@/lib/api.js';

const AuthContext = createContext(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // ---- helpers JWT ----
  const b64decode = (str) => {
    try { if (typeof atob === 'function') return atob(str); } catch {}
    try { return Buffer.from(str, 'base64').toString('binary'); } catch { return ''; }
  };

  const decodeToken = useCallback((t) => {
    try {
      const base64Url = t.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const json = decodeURIComponent(
        b64decode(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
      );
      return JSON.parse(json);
    } catch { return null; }
  }, []);

  const isTokenExpired = useCallback((t) => {
    const d = decodeToken(t);
    if (!d || !d.exp) return true;
    return Date.now() >= d.exp * 1000;
  }, [decodeToken]);

  const hydrateFromStorage = useCallback(() => {
    const stored = localStorage.getItem('authToken');
    if (stored && !isTokenExpired(stored)) {
      const d = decodeToken(stored);
      if (d) {
        setToken(stored);
        setUser({ id: d.sub, email: d.email, role: d.role, municipio_id: d.municipio_id });
        return true;
      }
    } else {
      localStorage.removeItem('authToken');
    }
    setToken(null);
    setUser(null);
    return false;
  }, [decodeToken, isTokenExpired]);

  useEffect(() => {
    hydrateFromStorage();
    setLoading(false);
  }, [hydrateFromStorage]);

  useEffect(() => {
    const onStorage = (e) => { if (e.key === 'authToken') hydrateFromStorage(); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [hydrateFromStorage]);

  // ---- acciones ----
  const login = async (email, password) => {
    try {
      const r = await authAPI.login(email, password);
      if (!r.ok) {
        let msg = 'Error de autenticación';
        try { const ed = await r.json(); msg = ed?.message || msg; } catch {}
        return { success: false, message: msg };
      }
      const data = await r.json();
      const newToken = data?.token;
      const d = newToken ? decodeToken(newToken) : null;
      if (!d) return { success: false, message: 'Token inválido' };

      localStorage.setItem('authToken', newToken);
      setToken(newToken);
      setUser({ id: d.sub, email: d.email, role: d.role, municipio_id: d.municipio_id });
      return { success: true, user: { id: d.sub, email: d.email, role: d.role, municipio_id: d.municipio_id } };
    } catch {
      return { success: false, message: 'Error de conexión' };
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('authToken');
  };

  // ✅ checkAuth local (sin red)
  const checkAuth = () => {
    const t = token || localStorage.getItem('authToken');
    if (!t || isTokenExpired(t)) return false;
    const d = decodeToken(t);
    return !!(d && d.sub);
  };

  // 🔒 checkAuth con servidor (si lo necesitás en algún lugar)
  const serverCheckAuth = async () => {
    const t = token || localStorage.getItem('authToken');
    if (!t || isTokenExpired(t)) return false;
    try {
      const res = await authAPI.checkAuth();
      if (!res.ok) return false;
      const data = await res.json();
      return !!data?.authenticated;
    } catch { return false; }
  };

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    checkAuth,        // local
    serverCheckAuth,  // remoto (opcional)
    authenticatedFetch, // helper central
    getToken: () => token || localStorage.getItem('authToken'),
    isAuthenticated: !!user,
    isAdmin: user?.role === 'ADMIN',
    isAlcalde: user?.role === 'ALCALDE',
    getMunicipioFromToken: () => user?.municipio_id,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
