import React, { useState, useEffect } from 'react';

const AdminPanel = ({ onZoneStateChange }) => {
  // Estados básicos
  const [isVisible, setIsVisible] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Estados para datos
  const [zones, setZones] = useState([]);
  const [statistics, setStatistics] = useState({});
  const [filteredZones, setFilteredZones] = useState([]);
  
  // Estados para funcionalidades
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedZones, setSelectedZones] = useState(new Set());
  const [selectedZone, setSelectedZone] = useState('');
  const [selectedState, setSelectedState] = useState('verde');
  const [notification, setNotification] = useState(null);
  const [activeTab, setActiveTab] = useState('individual');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const BACKEND_URL = 'https://cerro-largo-backend.onrender.com';

  // Mapeos de estados
  const stateMapping = {
    'verde': 'green',
    'amarillo': 'yellow',
    'rojo': 'red'
  };

  const reverseStateMapping = {
    'green': 'verde',
    'yellow': 'amarillo', 
    'red': 'rojo'
  };

  const stateLabels = {
    'verde': { label: 'Verde', emoji: '🟩', description: 'Habilitado - Sin restricciones' },
    'amarillo': { label: 'Amarillo', emoji: '🟨', description: 'Alerta - Posible cierre de caminería' },
    'rojo': { label: 'Rojo', emoji: '🟥', description: 'Suspendido - Prohibido tránsito pesado' }
  };

  // Función para mostrar notificaciones
  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Verificar autenticación al cargar
  useEffect(() => {
    checkAuth();
  }, []);

  // Auto-refresh cada 30 segundos si está habilitado
  useEffect(() => {
    if (isAuthenticated && autoRefresh) {
      const interval = setInterval(() => {
        loadData();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, autoRefresh]);

  // Filtrar zonas basado en búsqueda
  useEffect(() => {
    if (searchTerm) {
      const filtered = zones.filter(zone => 
        zone.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredZones(filtered);
    } else {
      setFilteredZones(zones);
    }
  }, [zones, searchTerm]);

  const checkAuth = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/admin/check-auth`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setIsAuthenticated(data.authenticated);
        if (data.authenticated) {
          loadData();
        }
      }
    } catch (error) {
      console.error('Error checking auth:', error);
    }
  };

  const loadData = async () => {
    await Promise.all([loadZones(), loadStatistics()]);
  };

  const loadZones = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/admin/zones/states`, {
        credentials: 'include'
      });
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.states) {
          const zonesArray = Object.entries(result.states).map(([name, data]) => ({
            name: name,
            state: reverseStateMapping[data.state] || data.state,
            updated_at: data.updated_at,
            updated_by: data.updated_by
          }));
          setZones(zonesArray.sort((a, b) => a.name.localeCompare(b.name)));
        }
      }
    } catch (error) {
      console.error('Error loading zones:', error);
      showNotification('Error al cargar zonas', 'error');
    }
  };

  const loadStatistics = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/report/generate-data`, {
        credentials: 'include'
      });
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setStatistics(result.report);
        }
      }
    } catch (error) {
      console.error('Error loading statistics:', error);
    }
  };

  const handleLogin = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setIsAuthenticated(true);
          setPassword('');
          showNotification('Autenticación exitosa', 'success');
          loadData();
        } else {
          showNotification(result.message || 'Error en la autenticación', 'error');
        }
      } else {
        showNotification('Contraseña incorrecta', 'error');
      }
    } catch (error) {
      console.error('Error during login:', error);
      showNotification('Error de conexión', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateState = async () => {
    if (!selectedZone) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/admin/zones/update-state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          zone_name: selectedZone,
          state: stateMapping[selectedState]
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          onZoneStateChange(selectedZone, selectedState);
          showNotification(`Estado de ${selectedZone} actualizado a ${stateLabels[selectedState].label}`, 'success');
          loadData();
          setSelectedZone('');
        } else {
          showNotification(result.message || 'Error al actualizar', 'error');
        }
      }
    } catch (error) {
      console.error('Error updating state:', error);
      showNotification('Error de conexión', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkUpdate = async (state) => {
    if (selectedZones.size === 0) {
      showNotification('Selecciona al menos una zona', 'warning');
      return;
    }

    const confirmed = window.confirm(
      `¿Confirmas actualizar ${selectedZones.size} zona(s) al estado ${stateLabels[state].label}?`
    );
    
    if (!confirmed) return;

    setIsLoading(true);
    try {
      const updates = Array.from(selectedZones).map(zoneName => ({
        zone_name: zoneName,
        state: stateMapping[state]
      }));

      const response = await fetch(`${BACKEND_URL}/api/admin/zones/bulk-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ updates }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          showNotification(`${selectedZones.size} zona(s) actualizadas a ${stateLabels[state].label}`, 'success');
          setSelectedZones(new Set());
          loadData();
          // Notificar cambios al mapa
          Array.from(selectedZones).forEach(zoneName => {
            onZoneStateChange(zoneName, state);
          });
        } else {
          showNotification(result.message || 'Error en actualización masiva', 'error');
        }
      }
    } catch (error) {
      console.error('Error in bulk update:', error);
      showNotification('Error de conexión', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadReport = () => {
    window.open(`${BACKEND_URL}/api/report/download`, '_blank');
    showNotification('Descargando reporte PDF...', 'info');
  };

  const handleLogout = async () => {
    try {
      await fetch(`${BACKEND_URL}/api/admin/logout`, {
        method: 'POST',
        credentials: 'include'
      });
      setIsAuthenticated(false);
      setIsVisible(false);
      setSelectedZones(new Set());
      showNotification('Sesión cerrada', 'info');
    } catch (error) {
      console.error('Error en logout:', error);
    }
  };

  const toggleZoneSelection = (zoneName) => {
    const newSelected = new Set(selectedZones);
    if (newSelected.has(zoneName)) {
      newSelected.delete(zoneName);
    } else {
      newSelected.add(zoneName);
    }
    setSelectedZones(newSelected);
  };

  const selectAllZones = () => {
    setSelectedZones(new Set(filteredZones.map(zone => zone.name)));
  };

  const clearSelection = () => {
    setSelectedZones(new Set());
  };

  const getStateColor = (state) => {
    const colors = {
      'verde': 'bg-green-100 text-green-800 border-green-200',
      'amarillo': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'rojo': 'bg-red-100 text-red-800 border-red-200'
    };
    return colors[state] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-[1000]">
        <button
          onClick={() => setIsVisible(true)}
          className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-lg shadow-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 font-medium flex items-center gap-2"
        >
          Administración
          <span>▲</span>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[1000] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl max-h-[90vh] overflow-y-auto">
        {/* Notificación */}
        {notification && (
          <div className={`fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-[1001] transition-all duration-300 ${
            notification.type === 'success' ? 'bg-green-500 text-white' :
            notification.type === 'error' ? 'bg-red-500 text-white' :
            notification.type === 'warning' ? 'bg-yellow-500 text-white' :
            'bg-blue-500 text-white'
          }`}>
            {notification.message}
          </div>
        )}

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-t-xl">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <span className="text-2xl"></span>
              <div>
                <h2 className="text-2xl font-bold">Administración</h2>
                <p className="text-blue-100">Sistema de Gestión de Caminería - Cerro Largo</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {isAuthenticated && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                    className="rounded"
                  />
                  Auto-actualizar
                </label>
              )}
              <button
                onClick={() => setIsVisible(false)}
                className="text-white hover:text-red-200 text-2xl font-bold transition-colors"
              >
                ✕
              </button>
            </div>
          </div>
        </div>

        <div className="p-6">
          {!isAuthenticated ? (
            /* Panel de Login */
            <div className="max-w-md mx-auto">
              <div className="bg-gray-50 p-8 rounded-lg border">
                <div className="text-center mb-6">
                  <span className="text-4xl mb-4 block"></span>
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">Acceso Restringido</h3>
                  <p className="text-gray-600">Ingresa la contraseña de administrador</p>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Contraseña:
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      placeholder="Ingresa la contraseña"
                      onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                      disabled={isLoading}
                    />
                  </div>
                  <button
                    onClick={handleLogin}
                    disabled={isLoading || !password}
                    className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
                  >
                    {isLoading ? 'Verificando...' : 'Iniciar Sesión'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Panel Principal */
            <div className="space-y-6">
              {/* Dashboard de Estadísticas */}
              {statistics.state_summary && (
                <div className="bg-gradient-to-r from-gray-50 to-blue-50 p-6 rounded-lg border">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                     Estadísticas Generales
                    <button
                      onClick={loadData}
                      className="ml-auto text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded-lg hover:bg-blue-200 transition-colors"
                    >
                       Actualizar
                    </button>
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white p-4 rounded-lg border text-center">
                      <div className="text-2xl font-bold text-gray-800">{statistics.total_zones}</div>
                      <div className="text-sm text-gray-600">Total Zonas</div>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg border text-center">
                      <div className="text-2xl font-bold text-green-700">
                        🟩 {statistics.state_summary.green || 0}
                      </div>
                      <div className="text-sm text-green-600">Habilitadas</div>
                    </div>
                    <div className="bg-yellow-50 p-4 rounded-lg border text-center">
                      <div className="text-2xl font-bold text-yellow-700">
                        🟨 {statistics.state_summary.yellow || 0}
                      </div>
                      <div className="text-sm text-yellow-600">En Alerta</div>
                    </div>
                    <div className="bg-red-50 p-4 rounded-lg border text-center">
                      <div className="text-2xl font-bold text-red-700">
                        🟥 {statistics.state_summary.red || 0}
                      </div>
                      <div className="text-sm text-red-600">Suspendidas</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tabs de Navegación */}
              <div className="border-b border-gray-200">
                <nav className="flex space-x-8">
                  <button
                    onClick={() => setActiveTab('individual')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'individual'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >  Actualización Individual
                  </button>
                  <button
                    onClick={() => setActiveTab('bulk')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'bulk'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Actualización Masiva
                  </button>
                  <button
                    onClick={() => setActiveTab('reports')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'reports'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Reportes
                  </button>
                </nav>
              </div>

              {/* Contenido de Tabs */}
              {activeTab === 'individual' && (
                <div className="bg-gray-50 p-6 rounded-lg border">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4"> Actualización Individual</h3>
                  <div className="grid md:grid-cols-3 gap-4 items-end">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Zona/Municipio:</label>
                      <select
                        value={selectedZone}
                        onChange={(e) => setSelectedZone(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Seleccionar zona...</option>
                        {zones.map((zone) => (
                          <option key={zone.name} value={zone.name}>
                            {stateLabels[zone.state]?.emoji} {zone.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Nuevo Estado:</label>
                      <select
                        value={selectedState}
                        onChange={(e) => setSelectedState(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        {Object.entries(stateLabels).map(([key, value]) => (
                          <option key={key} value={key}>
                            {value.emoji} {value.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={handleUpdateState}
                      disabled={!selectedZone || isLoading}
                      className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
                    >
                      {isLoading ? 'Actualizando...' : 'Actualizar Estado'}
                    </button>
                  </div>
                  {selectedZone && (
                    <div className="mt-4 p-4 bg-blue-50 rounded-lg border">
                      <p className="text-sm text-blue-700">
                        <strong>{selectedZone}</strong> cambiará a: <strong>{stateLabels[selectedState].label}</strong>
                        <br />
                        <span className="text-xs">{stateLabels[selectedState].description}</span>
                      </p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'bulk' && (
                <div className="space-y-6">
                  <div className="bg-gray-50 p-6 rounded-lg border">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold text-gray-800">  Actualización Masiva</h3>
                      <div className="text-sm text-gray-600">
                        {selectedZones.size} de {filteredZones.length} zona(s) seleccionada(s)
                      </div>
                    </div>
                    
                    {/* Controles de selección y búsqueda */}
                    <div className="flex flex-wrap gap-3 mb-4">
                      <input
                        type="text"
                        placeholder="🔍 Buscar zona..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="flex-1 min-w-64 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <button
                        onClick={selectAllZones}
                        className="bg-blue-100 text-blue-700 px-4 py-2 rounded-lg hover:bg-blue-200 transition-colors text-sm"
                      >
                        ☑️ Seleccionar Todas
                      </button>
                      <button
                        onClick={clearSelection}
                        className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                      >
                        ❌ Limpiar Selección
                      </button>
                    </div>

                    {/* Lista de zonas con checkboxes */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-64 overflow-y-auto border rounded-lg p-4 bg-white">
                      {filteredZones.map((zone) => (
                        <label
                          key={zone.name}
                          className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                            selectedZones.has(zone.name) 
                              ? 'bg-blue-50 border-blue-200' 
                              : 'bg-white border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedZones.has(zone.name)}
                            onChange={() => toggleZoneSelection(zone.name)}
                            className="mr-3 rounded text-blue-600 focus:ring-blue-500"
                          />
                          <div className="flex-1">
                            <div className="font-medium text-gray-800">{zone.name}</div>
                            <div className={`text-xs px-2 py-1 rounded-full inline-block ${getStateColor(zone.state)}`}>
                              {stateLabels[zone.state]?.emoji} {stateLabels[zone.state]?.label}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>

                    {/* Botones de actualización masiva */}
                    {selectedZones.size > 0 && (
                      <div className="mt-4 p-4 bg-yellow-50 rounded-lg border">
                        <p className="text-sm text-yellow-800 mb-3">
                          ⚠️ Vas a actualizar {selectedZones.size} zona(s). Selecciona el nuevo estado:
                        </p>
                        <div className="flex flex-wrap gap-3">
                          <button
                            onClick={() => handleBulkUpdate('verde')}
                            disabled={isLoading}
                            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors text-sm font-medium"
                          >
                            🟩 Marcar como Verde
                          </button>
                          <button
                            onClick={() => handleBulkUpdate('amarillo')}
                            disabled={isLoading}
                            className="bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600 disabled:bg-gray-400 transition-colors text-sm font-medium"
                          >
                            🟨 Marcar como Amarillo
                          </button>
                          <button
                            onClick={() => handleBulkUpdate('rojo')}
                            disabled={isLoading}
                            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:bg-gray-400 transition-colors text-sm font-medium"
                          >
                            🟥 Marcar como Rojo
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'reports' && (
                <div className="bg-gray-50 p-6 rounded-lg border">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">📋 Reportes y Exportación</h3>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-lg border">
                      <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                        <span>📄</span> Reporte PDF
                      </h4>
                      <p className="text-gray-600 text-sm mb-4">
                        Descarga un reporte profesional en PDF con el estado actual de todas las zonas, 
                        incluyendo estadísticas y detalles completos.
                      </p>
                      <button
                        onClick={handleDownloadReport}
                        className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm font-medium w-full"
                      >
                        Descargar Reporte PDF
                      </button>
                    </div>
                    
                    <div className="bg-white p-6 rounded-lg border">
                      <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                        <span>📊</span> Estadísticas Detalladas
                      </h4>
                      {statistics.generated_at && (
                        <div className="space-y-2 text-sm">
                          <div><strong>Última actualización:</strong> {new Date(statistics.generated_at).toLocaleString('es-ES')}</div>
                          <div><strong>Total de zonas:</strong> {statistics.total_zones}</div>
                          <div><strong>Distribución:</strong></div>
                          <ul className="ml-4 space-y-1">
                            <li>🟩 Habilitadas: {statistics.state_summary?.green || 0} ({Math.round((statistics.state_summary?.green || 0) / statistics.total_zones * 100)}%)</li>
                            <li>🟨 En Alerta: {statistics.state_summary?.yellow || 0} ({Math.round((statistics.state_summary?.yellow || 0) / statistics.total_zones * 100)}%)</li>
                            <li>🟥 Suspendidas: {statistics.state_summary?.red || 0} ({Math.round((statistics.state_summary?.red || 0) / statistics.total_zones * 100)}%)</li>
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="flex justify-between items-center pt-6 border-t border-gray-200">
                <div className="text-sm text-gray-500">
                  Sistema de Gestión de Caminería • Departamento de Cerro Largo
                </div>
                <button
                  onClick={handleLogout}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                >
                  Cerrar Sesión
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
