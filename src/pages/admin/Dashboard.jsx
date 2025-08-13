import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useRole } from '../../hooks/useRole';
import { zonesAPI } from '../../lib/api';
import MunicipiosTable from '../../components/admin/MunicipiosTable';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const { isAdmin, isAlcalde, currentMunicipio } = useRole();
  const [zoneStates, setZoneStates] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadZoneStates();
  }, []);

  const loadZoneStates = async () => {
    try {
      setLoading(true);
      const response = await zonesAPI.getStates();
      if (response.ok) {
        const data = await response.json();
        setZoneStates(data.states || {});
      } else {
        setError('Error al cargar estados de zonas');
      }
    } catch (error) {
      console.error('Error loading zone states:', error);
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const handleZoneStateChange = async (zoneName, newState) => {
    try {
      const response = await zonesAPI.updateState(zoneName, newState);
      if (response.ok) {
        setZoneStates(prev => ({
          ...prev,
          [zoneName]: { ...prev[zoneName], state: newState }
        }));
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Error al actualizar estado');
      }
    } catch (error) {
      console.error('Error updating zone state:', error);
      setError('Error de conexión');
    }
  };

  const handleBulkUpdate = async (updates) => {
    try {
      const response = await zonesAPI.bulkUpdate(updates);
      if (response.ok) {
        const data = await response.json();
        // Actualizar estados locales
        const updatedStates = { ...zoneStates };
        updates.forEach(update => {
          if (updatedStates[update.zone_name]) {
            updatedStates[update.zone_name].state = update.state;
          }
        });
        setZoneStates(updatedStates);
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Error en actualización masiva');
      }
    } catch (error) {
      console.error('Error in bulk update:', error);
      setError('Error de conexión');
    }
  };

  const getStateSummary = () => {
    const summary = { green: 0, yellow: 0, red: 0, total: 0 };
    Object.values(zoneStates).forEach(zone => {
      const state = zone.state || 'green';
      summary[state]++;
      summary.total++;
    });
    return summary;
  };

  const summary = getStateSummary();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Panel de Administración
              </h1>
              <p className="text-sm text-gray-600">
                Sistema de Gestión de Caminería - Cerro Largo
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{user?.email}</p>
                <p className="text-sm text-gray-500">
                  {isAdmin() ? 'Administrador' : `Alcalde - ${currentMunicipio}`}
                </p>
              </div>
              <button
                onClick={logout}
                className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
              >
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
            <button
              onClick={() => setError('')}
              className="ml-2 text-red-700 hover:text-red-900"
            >
              ✕
            </button>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-gray-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold">T</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Total Zonas
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {summary.total}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold">H</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Habilitadas
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {summary.green}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold">A</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      En Alerta
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {summary.yellow}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold">S</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Suspendidas
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {summary.red}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Municipios Table */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              {isAdmin() ? 'Gestión de Municipios' : `Mi Municipio: ${currentMunicipio}`}
            </h3>
            <MunicipiosTable
              zoneStates={zoneStates}
              onZoneStateChange={handleZoneStateChange}
              onBulkUpdate={handleBulkUpdate}
              onRefresh={loadZoneStates}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;

