import React, { useState, useEffect } from 'react';
import { useRole } from '../../hooks/useRole';
import { useAuth } from '../../hooks/useAuth.jsx';

const API_BASE = 'https://cerro-largo-backend.onrender.com/api/admin';

const UserManagement = () => {
  const { isAdmin } = useRole();
  const { authenticatedFetch } = useAuth();

  const [users, setUsers] = useState([]);
  const [municipios, setMunicipios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMunicipios, setLoadingMunicipios] = useState(false);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newUser, setNewUser] = useState({
    email: '',
    nombre: '',
    municipio_id: '',
    password: ''
  });

  useEffect(() => {
    const init = async () => {
      if (!isAdmin()) { setLoading(false); return; }
      await Promise.all([loadMunicipios(), loadUsers()]);
      setLoading(false);
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadUsers = async () => {
    try {
      const r = await authenticatedFetch(`${API_BASE}/users`);
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      setUsers(data);
    } catch (e) {
      console.error('Error loading users:', e);
      setError('Error al cargar usuarios');
    }
  };

  // Trae municipios desde el backend (keys de /zones/states)
  const loadMunicipios = async () => {
    try {
      setLoadingMunicipios(true);
      const r = await authenticatedFetch(`${API_BASE}/zones/states`);
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      const list = Object.keys(data?.states || {}).sort();
      setMunicipios(list);
    } catch (e) {
      console.error('Error loading municipios:', e);
      setError('Error al cargar municipios');
    } finally {
      setLoadingMunicipios(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const r = await authenticatedFetch(`${API_BASE}/users/alcalde`, {
        method: 'POST',
        body: JSON.stringify(newUser),
      });
      if (!r.ok) {
        let msg = 'Error al crear usuario';
        try { const ed = await r.json(); msg = ed?.message || msg; } catch {}
        throw new Error(msg);
      }
      setShowCreateForm(false);
      setNewUser({ email: '', nombre: '', municipio_id: '', password: '' });
      await loadUsers();
    } catch (e) {
      console.error('Error creating user:', e);
      setError(e.message || 'Error de conexión');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!confirm('¿Está seguro de eliminar este usuario?')) return;
    setError('');
    try {
      const r = await authenticatedFetch(`${API_BASE}/users/${userId}`, { method: 'DELETE' });
      if (!r.ok) {
        let msg = 'Error al eliminar usuario';
        try { const ed = await r.json(); msg = ed?.message || msg; } catch {}
        throw new Error(msg);
      }
      await loadUsers();
    } catch (e) {
      console.error('Error deleting user:', e);
      setError(e.message || 'Error de conexión');
    }
  };

  const toggleUserStatus = async (userId, currentStatus) => {
    setError('');
    try {
      const r = await authenticatedFetch(`${API_BASE}/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: !currentStatus }),
      });
      if (!r.ok) {
        let msg = 'Error al actualizar usuario';
        try { const ed = await r.json(); msg = ed?.message || msg; } catch {}
        throw new Error(msg);
      }
      await loadUsers();
    } catch (e) {
      console.error('Error updating user:', e);
      setError(e.message || 'Error de conexión');
    }
  };

  if (!isAdmin()) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No tienes permisos para acceder a esta sección.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
          <button
            onClick={() => setError('')}
            className="ml-2 text-red-700 hover:text-red-900"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Gestión de Usuarios</h2>
        <button
          onClick={() => setShowCreateForm(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
          disabled={loadingMunicipios}
        >
          Crear Alcalde
        </button>
      </div>

      {/* Create User Form */}
      {showCreateForm && (
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Crear Usuario Alcalde</h3>
          <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                required
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
              <input
                type="text"
                required
                value={newUser.nombre}
                onChange={(e) => setNewUser({ ...newUser, nombre: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Municipio {loadingMunicipios ? '(cargando...)' : ''}
              </label>
              <select
                required
                value={newUser.municipio_id}
                onChange={(e) => setNewUser({ ...newUser, municipio_id: e.target.value })}
                disabled={loadingMunicipios}
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Seleccionar municipio</option>
                {municipios.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña Temporal</label>
              <input
                type="password"
                required
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="md:col-span-2 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
                disabled={loadingMunicipios}
              >
                Crear Usuario
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usuario</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rol</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Municipio</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{u.nombre}</div>
                    <div className="text-sm text-gray-500">{u.email}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${u.role === 'ADMIN' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{u.municipio_id || 'N/A'}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${u.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {u.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => toggleUserStatus(u.id, u.is_active)}
                      className={`${u.is_active ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'}`}
                    >
                      {u.is_active ? 'Desactivar' : 'Activar'}
                    </button>
                    {u.role !== 'ADMIN' && (
                      <button
                        onClick={() => handleDeleteUser(u.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {users.length === 0 && (
        <div className="text-center py-8 text-gray-500">No hay usuarios registrados.</div>
      )}
    </div>
  );
};

export default UserManagement;
};

export default UserManagement;

