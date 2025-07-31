import React, { useState } from 'react';
import { useApi, ZoneData } from '../hooks/useApi';
import { Lock, Unlock, Save, LogOut } from 'lucide-react';

interface AdminPanelProps {
  zones: ZoneData;
  onZoneStateChange: (zoneName: string, newState: 'green' | 'yellow' | 'red') => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ zones, onZoneStateChange }) => {
  const { isAuthenticated, adminLogin, adminLogout, updateZoneState } = useApi();
  const [showPanel, setShowPanel] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    
    const result = await adminLogin(loginForm.username, loginForm.password);
    
    if (result.success) {
      setShowPanel(true);
      setLoginForm({ username: '', password: '' });
    } else {
      setLoginError(result.message);
    }
  };

  const handleLogout = async () => {
    await adminLogout();
    setShowPanel(false);
  };

  const handleStateChange = async (zoneName: string, newState: 'green' | 'yellow' | 'red') => {
    setSaving(true);
    const result = await updateZoneState(zoneName, newState);
    
    if (result.success) {
      onZoneStateChange(zoneName, newState);
    } else {
      alert(`Error: ${result.message}`);
    }
    setSaving(false);
  };

  const getStateLabel = (state: string) => {
    switch (state) {
      case 'green': return '🟩 Habilitado';
      case 'yellow': return '🟨 Alerta';
      case 'red': return '🟥 Suspendido';
      default: return '⚪ Sin estado';
    }
  };

  const getStateColor = (state: string) => {
    switch (state) {
      case 'green': return 'bg-green-100 border-green-500';
      case 'yellow': return 'bg-yellow-100 border-yellow-500';
      case 'red': return 'bg-red-100 border-red-500';
      default: return 'bg-gray-100 border-gray-500';
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="fixed top-4 left-4 z-[1000]">
        <button
          onClick={() => setShowPanel(!showPanel)}
          className="bg-blue-600 text-white p-3 rounded-lg shadow-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Lock size={20} />
          Admin
        </button>

        {showPanel && (
          <div className="absolute top-full left-0 mt-2 bg-white p-6 rounded-lg shadow-xl border min-w-[300px]">
            <h3 className="text-lg font-semibold mb-4 text-gray-800">Acceso de Administrador</h3>
            
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Usuario
                </label>
                <input
                  type="text"
                  value={loginForm.username}
                  onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contraseña
                </label>
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              {loginError && (
                <div className="text-red-600 text-sm">{loginError}</div>
              )}
              
              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <Unlock size={16} />
                Ingresar
              </button>
            </form>
            
            <div className="mt-4 text-xs text-gray-500 text-center">
              Usuario: admin | Contraseña: admin123
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="fixed top-4 left-4 z-[1000]">
      <button
        onClick={() => setShowPanel(!showPanel)}
        className="bg-green-600 text-white p-3 rounded-lg shadow-lg hover:bg-green-700 transition-colors flex items-center gap-2"
      >
        <Unlock size={20} />
        Panel Admin
      </button>

      {showPanel && (
        <div className="absolute top-full left-0 mt-2 bg-white rounded-lg shadow-xl border max-w-sm max-h-96 overflow-y-auto">
          <div className="p-4 border-b bg-gray-50">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-800">Control de Estados</h3>
              <button
                onClick={handleLogout}
                className="text-red-600 hover:text-red-800 flex items-center gap-1 text-sm"
              >
                <LogOut size={16} />
                Salir
              </button>
            </div>
          </div>
          
          <div className="p-4 space-y-3">
            {Object.entries(zones).map(([zoneName, zoneData]) => (
              <div key={zoneName} className={`p-3 rounded-lg border ${getStateColor(zoneData.state)}`}>
                <div className="font-medium text-sm text-gray-800 mb-2">{zoneName}</div>
                <div className="text-xs text-gray-600 mb-2">
                  Estado actual: {getStateLabel(zoneData.state)}
                </div>
                
                <div className="flex gap-1">
                  <button
                    onClick={() => handleStateChange(zoneName, 'green')}
                    disabled={saving || zoneData.state === 'green'}
                    className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Verde
                  </button>
                  <button
                    onClick={() => handleStateChange(zoneName, 'yellow')}
                    disabled={saving || zoneData.state === 'yellow'}
                    className="px-2 py-1 text-xs bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Amarillo
                  </button>
                  <button
                    onClick={() => handleStateChange(zoneName, 'red')}
                    disabled={saving || zoneData.state === 'red'}
                    className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Rojo
                  </button>
                </div>
                
                {zoneData.updated_at && (
                  <div className="text-xs text-gray-500 mt-1">
                    Actualizado: {new Date(zoneData.updated_at).toLocaleString('es-UY')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
