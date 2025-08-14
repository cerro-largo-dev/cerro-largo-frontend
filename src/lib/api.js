// src/lib/api.js

// Punto base del backend (podés override con VITE_BACKEND_URL en .env)
export const BACKEND_URL =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_BACKEND_URL) ||
  'https://cerro-largo-backend.onrender.com';

/**
 * fetch autenticado
 * - Acepta path relativo (recomendado) o URL completa
 * - Agrega Authorization: Bearer <token>
 * - Auto-JSON si body es objeto (convierte y setea Content-Type)
 */
export const authenticatedFetch = async (pathOrUrl, options = {}) => {
  const url = /^https?:\/\//i.test(pathOrUrl) ? pathOrUrl : `${BACKEND_URL}${pathOrUrl}`;
  const token = localStorage.getItem('authToken');

  if (!token) {
    throw new Error('No authentication token available');
  }

  let { headers, body, ...rest } = options || {};
  headers = { ...(headers || {}) };

  // Si el body es objeto y no es FormData, serializamos como JSON
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  if (body && !isFormData && !headers['Content-Type'] && !headers['content-type']) {
    headers['Content-Type'] = 'application/json';
    if (typeof body !== 'string') body = JSON.stringify(body);
  }

  // Authorization
  if (!headers['Authorization'] && !headers['authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, { headers, body, ...rest });

  // Si expira el token, lo limpiamos (el UI debería redirigir al login)
  if (res.status === 401) {
    localStorage.removeItem('authToken');
  }

  return res;
};

// ---------- APIs específicas ----------

// Auth
export const authAPI = {
  login: (email, password) =>
    fetch(`${BACKEND_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }),

  checkAuth: () => authenticatedFetch('/api/admin/check-auth', { method: 'GET' }),
};

// Zonas
export const zonesAPI = {
  getStates: () => authenticatedFetch('/api/admin/zones/states'),
  updateState: (zoneName, state) =>
    authenticatedFetch('/api/admin/zones/update-state', {
      method: 'POST',
      body: { zone_name: zoneName, state },
    }),
  bulkUpdate: (updates) =>
    authenticatedFetch('/api/admin/zones/bulk-update', {
      method: 'POST',
      body: { updates },
    }),
  generateReport: () => authenticatedFetch('/api/admin/report/generate'),
};

// Usuarios (ADMIN)
export const usersAPI = {
  list: () => authenticatedFetch('/api/admin/users'),
  createAlcalde: ({ email, nombre, municipio_id, password }) =>
    authenticatedFetch('/api/admin/users/alcalde', {
      method: 'POST',
      body: { email, nombre, municipio_id, password },
    }),
  update: (id, patch) =>
    authenticatedFetch(`/api/admin/users/${id}`, {
      method: 'PUT',
      body: patch,
    }),
  remove: (id) =>
    authenticatedFetch(`/api/admin/users/${id}`, {
      method: 'DELETE',
    }),
  // reset por el propio usuario logueado
  passwordReset: (new_password) =>
    authenticatedFetch('/api/admin/password-reset', {
      method: 'POST',
      body: { new_password },
    }),
};
