import { useState, useEffect, createContext, useContext, useCallback } from 'react';

// Contexto
const AuthContext = createContext(null);

// Hook
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser]   = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Base64 seguro (soporta entornos sin atob)
  const b64decode = (str) => {
    try { if (typeof atob === 'function') return atob(str); } catch {}
    try { return Buffer.from(str, 'base64').toString('binary'); } catch { return ''; }
  };

  // Decodificar JWT
  const decodeToken = useCallback((t) => {
    try {
      const base64Url = t.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        b64decode(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (err) {
      console.error('Error decoding token:', err);
      return null;
    }
  }, []);

  const isTokenExpired = useCallback((t) => {
    const decoded = decodeToken(t);
    if (!decoded || !decoded.exp) return true;
    return Date.now() >= decoded.exp * 1000;
  }, [decodeToken]);

  // Rehidratar desde localStorage
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
    return false;
  }, [decodeToken, isTokenExpired]);

  useEffect(() => {
    hydrateFromStorage();
    setLoading(false);
  }, [hydrateFromStorage]);

  // Sincronizar entre pestañas
  useEffect(() => {
    const onStorage = (e) => { if (e.key === 'authToken') hydrateFromStorage(); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [hydrateFromStorage]);

  // Login
  const login = async (email, password) => {
    try {
      const response = await fetch('https://cerro-largo-backend.onrender.com/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        const data = await response.json();
        const newToken = data?.token;
        const d = newToken ? decodeToken(newToken) : null;
        if (d) {
          const userData = { id: d.sub, email: d.email, role: d.role, municipio_id: d.municipio_id };
          localStorage.setItem('authToken', newToken);
          setToken(newToken);
          setUser(userData);
          return { success: true, user: userData };
        }
        return { success: false, message: 'Token inválido' };
      } else {
        let msg = 'Error de autenticación';
        try { const ed = await response.json(); msg = ed?.message || msg; } catch {}
        return { success: false, message: msg };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, message: 'Error de conexión' };
    }
  };

  // Logout
  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('authToken');
  };

  // Verificar con servidor
  const checkAuth = async () => {
    const t = token || localStorage.getItem('authToken');
    if (!t) return false;
    try {
      const response = await fetch('https://cerro-largo-backend.onrender.com/api/admin/check-auth', {
        headers: { 'Authorization': `Bearer ${t}` },
      });
      if (response.ok) {
        const data = await response.json();
        return !!data?.authenticated;
      } else {
        logout();
        return false;
      }
    } catch (error) {
      console.error('Auth check error:', error);
      return false;
    }
  };

  // Obtener token actual
  const getToken = () => token || localStorage.getItem('authToken');

  // Fetch autenticado (✅ ahora hace fallback a localStorage)
  const authenticatedFetch = async (url, options = {}) => {
    const t = token || localStorage.getItem('authToken');
    if (!t) {
      console.warn('authenticatedFetch sin token:', url);
      throw new Error('No authentication token available');
    }
    const headers = { ...(options.headers || {}) };
    if (!headers['Authorization'] && !headers['authorization']) {
      headers['Authorization'] = `Bearer ${t}`;
    }
    if (options.body !== undefined && !headers['Content-Type'] && !headers['content-type']) {
      headers['Content-Type'] = 'application/json';
    }
    // Debug útil
    if (process.env.NODE_ENV !== 'production') {
      console.debug('authFetch →', url, { hasToken: !!t });
    }
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      logout();
      throw new Error('Authentication expired');
    }
    return res;
  };

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    checkAuth,
    getToken,
    authenticatedFetch,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'ADMIN',
    isAlcalde: user?.role === 'ALCALDE',
    getMunicipioFromToken: () => user?.municipio_id,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

