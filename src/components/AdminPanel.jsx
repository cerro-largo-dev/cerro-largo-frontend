import React, { useState } from 'react';

const AdminPanel = ({ onZoneStateChange }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [zones, setZones] = useState([]);
  const [selectedZone, setSelectedZone] = useState('');
  const [selectedState, setSelectedState] = useState('green');
  const [isLoading, setIsLoading] = useState(false);

  const BACKEND_URL = 'https://cerro-largo-backend.onrender.com';

  // Función para cargar las zonas usando el endpoint correcto
  const loadZones = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/admin/zones/states`);
      if (response.ok) {
        const zonesData = await response.json();
        setZones(zonesData.states); // Se espera que el JSON tenga una propiedad "states"
      } else {
        console.error('Error fetching zones:', response.status);
      }
    } catch (error) {
      console.error('Error loading zones:', error);
    }
  };

  // Maneja el login, utilizando preventDefault para evitar submit no deseado
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${BACKEND_URL}/api/admin/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password })
      });

      if (response.ok) {
        setIsAuthenticated(true);
        setPassword('');
        loadZones();
      } else {
        alert('Contraseña incorrecta');
      }
    } catch (error) {
      console.error('Error during login:', error);
      alert('Error de conexión');
    }
  };

  // Maneja el update del estado para la zona seleccionada
  const handleUpdateState = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/admin/zones/update-state`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          zone_name: selectedZone,
          state: selectedState
        })
      });

      if (response.ok) {
        if (onZoneStateChange) {
          onZoneStateChange(selectedZone, selectedState);
        }
        loadZones();
        alert('Estado actualizado correctamente');
      } else {
        alert('Error al actualizar el estado');
      }
    } catch (error) {
      console.error('Error updating state:', error);
      alert('Error de conexión');
    } finally {
      setIsLoading(false);
    }
  };

  // Maneja el logout para finalizar la sesión del administrador
  const handleLogout = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/admin/logout`, {
        method: 'POST'
      });
      if (response.ok) {
        setIsAuthenticated(false);
        setIsVisible(false);
      }
    } catch (error) {
      console.error('Error durante el logout:', error);
    }
  };

  // Cuando el panel no está visible, mostramos sólo el botón "Admin" con el estilo adecuado
  if (!isVisible) {
    return (
      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-[1000]">
        <button
          type="button"
          onClick={() => setIsVisible(true)}
          className="bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-gray-700 transition-colors"
        >
          ▲ Admin
        </button>
      </div>
    );
  }

  // Panel completo de administrador (login, update de zona y logout)
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-300 shadow-lg z-[1000] p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Panel de Administrador</h3>
          <button
            type="button"
            onClick={() => setIsVisible(false)}
            className="text-gray-600 hover:text-gray-800"
          >
            Cerrar
          </button>
        </div>

        {!isAuthenticated ? (
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Ingrese la contraseña"
              className="border border-gray-300 rounded px-3 py-2"
            />
            <button 
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
            >
              Ingresar
            </button>
          </form>
        ) : (
          <div className="flex flex-col gap-4">
            <form onSubmit={handleUpdateState} className="flex flex-col gap-4">
              <div className="flex flex-col">
                <label className="text-gray-700">Zona:</label>
                <select
                  value={selectedZone}
                  onChange={(e) => setSelectedZone(e.target.value)}
                  className="border border-gray-300 rounded px-3 py-2"
                >
                  <option value="">Seleccione una zona</option>
                  {zones && zones.map((zone, index) => (
                    <option key={index} value={zone.name}>
                      {zone.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-gray-700">Estado:</label>
                <select
                  value={selectedState}
                  onChange={(e) => setSelectedState(e.target.value)}
                  className="border border-gray-300 rounded px-3 py-2"
                >
                  <option value="green">Green</option>
                  <option value="yellow">Yellow</option>
                  <option value="red">Red</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors"
              >
                {isLoading ? 'Actualizando...' : 'Actualizar'}
              </button>
            </form>
            <button
              type="button"
              onClick={handleLogout}
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
