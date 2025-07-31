import React, { useState, useEffect } from 'react';

const AdminPanel = ({ onZoneStateChange }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [zones, setZones] = useState([]);
  const [selectedZone, setSelectedZone] = useState('');
  const [selectedState, setSelectedState] = useState('verde');
  const [isLoading, setIsLoading] = useState(false);

  const BACKEND_URL = 'https://cerro-largo-backend.onrender.com';

  // Mapeo de estados frontend -> backend
  const stateMapping = {
    'verde': 'green',
    'amarillo': 'yellow',
    'rojo': 'red'
  };

  // Mapeo inverso backend -> frontend
  const reverseStateMapping = {
    'green': 'verde',
    'yellow': 'amarillo', 
    'red': 'rojo'
  };

  // Verificar autenticación al cargar el componente
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/admin/check-auth`, {
          credentials: 'include'
        });
        if (response.ok) {
          const data = await response.json();
          setIsAuthenticated(data.authenticated);
          if (data.authenticated) {
            loadZones();
          }
        }
      } catch (error) {
        console.error('Error checking auth:', error);
      }
    };
    
    checkAuth();
  }, []);

  const loadZones = async () => {
    try {
      // CORRECCIÓN: Ruta correcta para obtener zonas
      const response = await fetch(`${BACKEND_URL}/api/admin/zones/states`, {
        credentials: 'include'
      });
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.states) {
          // Convertir el objeto de estados a array para el frontend
          const zonesArray = Object.entries(result.states).map(([name, data]) => ({
            name: name,
            state: reverseStateMapping[data.state] || data.state
          }));
          setZones(zonesArray);
        }
      }
    } catch (error) {
      console.error('Error loading zones:', error);
    }
  };

  const handleLogin = async () => {
    try {
      // CORRECCIÓN: Agregar credentials para mantener sesión
      const response = await fetch(`${BACKEND_URL}/api/admin/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setIsAuthenticated(true);
          setPassword('');
          loadZones();
        } else {
          alert(result.message || 'Error en la autenticación');
        }
      } else {
        alert('Contraseña incorrecta');
      }
    } catch (error) {
      console.error('Error during login:', error);
      alert('Error de conexión');
    }
  };

  const handleUpdateState = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // CORRECCIÓN: Ruta correcta y parámetros correctos
      const response = await fetch(`${BACKEND_URL}/api/admin/zones/update-state`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          zone_name: selectedZone,  // CORRECCIÓN: zone -> zone_name
          state: stateMapping[selectedState]  // CORRECCIÓN: mapear estado al formato del backend
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // Convertir el estado de vuelta al formato del frontend para el callback
          onZoneStateChange(selectedZone, selectedState);
          loadZones();
          alert('Estado actualizado correctamente');
        } else {
          alert(result.message || 'Error al actualizar el estado');
        }
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

  const handleLogout = async () => {
    try {
      await fetch(`${BACKEND_URL}/api/admin/logout`, {
        method: 'POST',
        credentials: 'include'
      });
      setIsAuthenticated(false);
      setIsVisible(false);
    } catch (error) {
      console.error('Error en logout:', error);
    }
  };

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-[1000]">
        <button
          onClick={() => setIsVisible(true)}
          className="bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-gray-700 transition-colors"
        >
          ▲ Admin
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-300 shadow-lg z-[1000] p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Panel de Administrador</h3>
          <button
            onClick={() => setIsVisible(false)}
            className="text-gray-600 hover:text-gray-800 text-xl"
          >
            ✕
          </button>
        </div>

        {!isAuthenticated ? (
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">Contraseña:</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 text-sm"
              placeholder="Ingresa la contraseña"
              onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
            />
            <button
              onClick={handleLogin}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors text-sm"
            >
              Ingresar
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Zona:</label>
                <select
                  value={selectedZone}
                  onChange={(e) => setSelectedZone(e.target.value)}
                  className="border border-gray-300 rounded px-3 py-2 text-sm"
                >
                  <option value="">Seleccionar zona</option>
                  {zones.map((zone) => (
                    <option key={zone.name} value={zone.name}>
                      {zone.name} - {zone.state === 'verde' ? '🟩' : zone.state === 'amarillo' ? '🟨' : '🟥'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Estado:</label>
                <select
                  value={selectedState}
                  onChange={(e) => setSelectedState(e.target.value)}
                  className="border border-gray-300 rounded px-3 py-2 text-sm"
                >
                  <option value="verde">🟩 Verde</option>
                  <option value="amarillo">🟨 Amarillo</option>
                  <option value="rojo">🟥 Rojo</option>
                </select>
              </div>

              <button
                onClick={handleUpdateState}
                disabled={!selectedZone || isLoading}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors text-sm disabled:bg-gray-400"
              >
                {isLoading ? 'Actualizando...' : 'Actualizar Estado'}
              </button>

              <button
                onClick={handleLogout}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors text-sm"
              >
                Cerrar Sesión
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;