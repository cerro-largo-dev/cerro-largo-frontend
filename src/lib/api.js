const BACKEND_URL = 'https://cerro-largo-backend.onrender.com';

// Función helper para hacer requests autenticados
const authenticatedFetch = async (url, options = {}) => {
  const token = localStorage.getItem('authToken');
  
  if (!token) {
    throw new Error('No authentication token available');
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    ...options.headers,
  };

  const response = await fetch(`${BACKEND_URL}${url}`, {
    ...options,
    headers,
  });

  // Si el token ha expirado, limpiar localStorage
  if (response.status === 401) {
    localStorage.removeItem('authToken');
    window.location.href = '/login';
    throw new Error('Authentication expired');
  }

  return response;
};

// API de autenticación
export const authAPI = {
  login: async (email, password) => {
    const response = await fetch(`${BACKEND_URL}/api/admin/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });
    return response;
  },

  checkAuth: async () => {
    return authenticatedFetch('/api/admin/check-auth');
  },

  resetPassword: async (newPassword) => {
    return authenticatedFetch('/api/admin/password-reset', {
      method: 'POST',
      body: JSON.stringify({ new_password: newPassword }),
    });
  },
};

// API de zonas/municipios
export const zonesAPI = {
  getStates: async () => {
    return authenticatedFetch('/api/admin/zones/states');
  },

  updateState: async (zoneName, state) => {
    return authenticatedFetch('/api/admin/zones/update-state', {
      method: 'POST',
      body: JSON.stringify({ zone_name: zoneName, state }),
    });
  },

  bulkUpdate: async (updates) => {
    return authenticatedFetch('/api/admin/zones/bulk-update', {
      method: 'POST',
      body: JSON.stringify({ updates }),
    });
  },

  generateReport: async () => {
    return authenticatedFetch('/api/admin/report/generate');
  },
};

// API de usuarios (solo para ADMIN)
export const usersAPI = {
  getAll: async () => {
    return authenticatedFetch('/api/admin/users');
  },

  createAlcalde: async (userData) => {
    return authenticatedFetch('/api/admin/users/alcalde', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  update: async (userId, userData) => {
    return authenticatedFetch(`/api/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  },

  delete: async (userId) => {
    return authenticatedFetch(`/api/admin/users/${userId}`, {
      method: 'DELETE',
    });
  },
};

// API de reportes públicos
export const reportsAPI = {
  download: async () => {
    const response = await fetch(`${BACKEND_URL}/api/report/download`);
    return response;
  },

  generateData: async () => {
    const response = await fetch(`${BACKEND_URL}/api/report/generate-data`);
    return response;
  },
};

// API de reportes ciudadanos
export const ciudadanosAPI = {
  getAll: async (page = 1, perPage = 10) => {
    const response = await fetch(`${BACKEND_URL}/api/reportes?page=${page}&per_page=${perPage}`);
    return response;
  },

  getById: async (reporteId) => {
    const response = await fetch(`${BACKEND_URL}/api/reportes/${reporteId}`);
    return response;
  },

  create: async (formData) => {
    // Para FormData no establecemos Content-Type, el navegador lo hace automáticamente
    const token = localStorage.getItem('authToken');
    const response = await fetch(`${BACKEND_URL}/api/reportes`, {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: formData,
    });
    return response;
  },

  delete: async (reporteId) => {
    return authenticatedFetch(`/api/reportes/${reporteId}`, {
      method: 'DELETE',
    });
  },
};

