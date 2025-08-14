import { useState, useEffect, createContext, useContext } from 'react';

// Crear contexto de autenticación
const AuthContext = createContext();

// Hook para usar el contexto de autenticación
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Proveedor de autenticación
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Función para decodificar JWT (sin verificar firma, solo para leer payload)
  const decodeToken = (token) => {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  };

  // Función para verificar si el token ha expirado
  const isTokenExpired = (token) => {
    const decoded = decodeToken(token);
    if (!decoded || !decoded.exp) return true;
    return Date.now() >= decoded.exp * 1000;
  };

  // Función para cargar el usuario desde localStorage al iniciar
  useEffect(() => {
    const storedToken = localStorage.getItem('authToken');
    if (storedToken && !isTokenExpired(storedToken)) {
      const decoded = decodeToken(storedToken);
      if (decoded) {
        setToken(storedToken);
        setUser({
          id: decoded.sub,
          email: decoded.email,
          role: decoded.role,
          municipio_id: decoded.municipio_id
        });
      }
    }
    setLoading(false);
  }, []);

  // Función para hacer login
  const login = async (email, password) => {
    try {
      const response = await fetch('https://cerro-largo-backend.onrender.com/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        const data = await response.json();
        const { token: newToken, role, municipio_id } = data;
        
        // Decodificar el token para obtener información del usuario
        const decoded = decodeToken(newToken);
        if (decoded) {
          const userData = {
            id: decoded.sub,
            email: decoded.email,
            role: decoded.role,
            municipio_id: decoded.municipio_id
          };

          setToken(newToken);
          setUser(userData);
          localStorage.setItem('authToken', newToken);
          
          return { success: true, user: userData };
        }
      } else {
        const errorData = await response.json();
        return { success: false, message: errorData.message || 'Error de autenticación' };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, message: 'Error de conexión' };
    }
  };

  // Función para hacer logout
  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('authToken');
  };

  // Función para verificar autenticación con el servidor
  const checkAuth = async () => {
    if (!token) return false;

    try {
      const response = await fetch('https://cerro-largo-backend.onrender.com/api/admin/check-auth', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        return data.authenticated;
      } else {
        // Token inválido, hacer logout
        logout();
        return false;
      }
    } catch (error) {
      console.error('Auth check error:', error);
      return false;
    }
  };

  // Función para obtener el token actual
  const getToken = () => token;

  // Función para hacer requests autenticados
  const authenticatedFetch = async (url, options = {}) => {
    if (!token) {
      throw new Error('No authentication token available');
    }

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Si el token ha expirado, hacer logout
    if (response.status === 401) {
      logout();
      throw new Error('Authentication expired');
    }

    return response;
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

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
