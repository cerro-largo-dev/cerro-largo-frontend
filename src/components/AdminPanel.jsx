import React, { useState, useEffect } from 'react';
const BACKEND_URL = 'https://cerro-largo-backend.onrender.com/';

const AdminPanel = ({ onZoneStateChange, zoneStates, zones }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const [selectedZone, setSelectedZone] = useState('');
  const [selectedState, setSelectedState] = useState('green');
  const [isLoading, setIsLoading] = useState(false);

  // Verificar autenticación al cargar
  useEffect(() => {
    checkAuthentication();
  }, []);

  const checkAuthentication = async () => {
    try {
      const response = await fetch('/api/admin/check-auth', {
        credentials: 'include'
      });
      const data = await response.json();
      setIsAuthenticated(data.authenticated);
    } catch (error) {
      console.error('Error verificando autenticación:', error);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ password })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setIsAuthenticated(true);
        setPassword('');
        alert('Autenticación exitosa');
      } else {
        alert('Contraseña incorrecta');
      }
    } catch (error) {
      console.error('Error en login:', error);
      alert('Error de conexión');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        credentials: 'include'
      });
      setIsAuthenticated(false);
      setIsVisible(false);
    } catch (error) {
      console.error('Error en logout:', error);
    }
  };

  const handleUpdateZoneState = async () => {
    if (!selectedZone || !selectedState) {
      alert('Selecciona una zona y un estado');
      return;
    }

    setIsLoading(true);
    
    try {
      const response = await fetch('/api/admin/zones/update-state', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          zone_name: selectedZone,
          state: selectedState
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        onZoneStateChange(selectedZone, selectedState);
        alert('Estado actualizado correctamente');
        setSelectedZone('');
        setSelectedState('green');
      } else {
        alert('Error al actualizar estado: ' + data.message);
      }
    } catch (error) {
      console.error('Error actualizando estado:', error);
      alert('Error de conexión');
    } finally {
      setIsLoading(false);
    }
  };

  const getStateColor = (state) => {
    switch (state) {
      case 'green': return '#22c55e';
      case 'yellow': return '#eab308';
      case 'red': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getStateLabel = (state) => {
    switch (state) {
      case 'green': return '🟩 Habilitado';
      case 'yellow': return '🟨 Alerta';
      case 'red': return '🟥 Suspendido';
      default: return 'Sin estado';
    }
  };

  if (!isAuthenticated) {
    return (
      <div className={`admin-panel ${isVisible ? 'visible' : ''}`}>
        <button 
          className="admin-toggle"
          onClick={() => setIsVisible(!isVisible)}
        >
          {isVisible ? '▼' : '▲'} Admin
        </button>
        
        {isVisible && (
          <div className="admin-content">
            <h4>Acceso Administrador</h4>
            <form onSubmit={handleLogin}>
              <input
                type="password"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
              <button type="submit" disabled={isLoading}>
                {isLoading ? 'Verificando...' : 'Ingresar'}
              </button>
            </form>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`admin-panel authenticated ${isVisible ? 'visible' : ''}`}>
      <button 
        className="admin-toggle"
        onClick={() => setIsVisible(!isVisible)}
      >
        {isVisible ? '▼' : '▲'} Panel Admin
      </button>
      
      {isVisible && (
        <div className="admin-content">
          <div className="admin-header">
            <h4>Panel de Control</h4>
            <button onClick={handleLogout} className="logout-btn">
              Cerrar Sesión
            </button>
          </div>
          
          <div className="zone-controls">
            <div className="control-group">
              <label>Zona/Municipio:</label>
              <select 
                value={selectedZone} 
                onChange={(e) => setSelectedZone(e.target.value)}
              >
                <option value="">Seleccionar zona...</option>
                {zones.map(zone => (
                  <option key={zone} value={zone}>{zone}</option>
                ))}
              </select>
            </div>
            
            <div className="control-group">
              <label>Estado:</label>
              <select 
                value={selectedState} 
                onChange={(e) => setSelectedState(e.target.value)}
              >
                <option value="green">🟩 Habilitado</option>
                <option value="yellow">🟨 Alerta</option>
                <option value="red">🟥 Suspendido</option>
              </select>
            </div>
            
            <div className="button-group">
              <button 
                onClick={handleUpdateZoneState}
                disabled={isLoading || !selectedZone}
                className="update-btn"
              >
                {isLoading ? 'Actualizando...' : 'Actualizar Estado'}
              </button>
            </div>
          </div>
          
          <div className="current-states">
            <h5>Estados Actuales:</h5>
            <div className="states-list">
              {Object.entries(zoneStates).map(([zone, state]) => (
                <div key={zone} className="state-item">
                  <span className="zone-name">{zone}</span>
                  <span 
                    className="state-indicator"
                    style={{ color: getStateColor(state) }}
                  >
                    {getStateLabel(state)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;

