import React, { useState } from 'react';
import { useRole } from '../../hooks/useRole';

const MunicipiosTable = ({ zoneStates, onZoneStateChange, onBulkUpdate, onRefresh }) => {
  const { isAdmin, isAlcalde, canEditMunicipio, getAccessibleMunicipios } = useRole();
  const [selectedZones, setSelectedZones] = useState([]);
  const [bulkState, setBulkState] = useState('green');

  // Filtrar zonas según el rol del usuario
  const accessibleZones = Object.keys(zoneStates).filter(zoneName => {
    return getAccessibleMunicipios(Object.keys(zoneStates)).includes(zoneName);
  });

  const getStateColor = (state) => {
    switch (state) {
      case 'green':
        return 'bg-green-100 text-green-800';
      case 'yellow':
        return 'bg-yellow-100 text-yellow-800';
      case 'red':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStateText = (state) => {
    switch (state) {
      case 'green':
        return 'Habilitado';
      case 'yellow':
        return 'Alerta';
      case 'red':
        return 'Suspendido';
      default:
        return 'Desconocido';
    }
  };

  const handleSelectZone = (zoneName) => {
    setSelectedZones(prev => 
      prev.includes(zoneName)
        ? prev.filter(z => z !== zoneName)
        : [...prev, zoneName]
    );
  };

  const handleSelectAll = () => {
    if (selectedZones.length === accessibleZones.length) {
      setSelectedZones([]);
    } else {
      setSelectedZones([...accessibleZones]);
    }
  };

  const handleBulkUpdate = () => {
    if (selectedZones.length === 0) return;

    const updates = selectedZones.map(zoneName => ({
      zone_name: zoneName,
      state: bulkState
    }));

    onBulkUpdate(updates);
    setSelectedZones([]);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('es-UY');
  };

  return (
    <div className="space-y-4">
      {/* Bulk Actions */}
      {isAdmin() && selectedZones.length > 0 && (
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between">
            <span className="text-sm text-blue-800">
              {selectedZones.length} zona(s) seleccionada(s)
            </span>
            <div className="flex items-center space-x-2">
              <select
                value={bulkState}
                onChange={(e) => setBulkState(e.target.value)}
                className="text-sm border border-gray-300 rounded px-2 py-1"
              >
                <option value="green">Habilitar</option>
                <option value="yellow">Alerta</option>
                <option value="red">Suspender</option>
              </select>
              <button
                onClick={handleBulkUpdate}
                className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
              >
                Aplicar
              </button>
              <button
                onClick={() => setSelectedZones([])}
                className="bg-gray-600 text-white px-3 py-1 rounded text-sm hover:bg-gray-700"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Actions Bar */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-2">
          {isAdmin() && (
            <button
              onClick={handleSelectAll}
              className="text-sm text-indigo-600 hover:text-indigo-800"
            >
              {selectedZones.length === accessibleZones.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
            </button>
          )}
        </div>
        <button
          onClick={onRefresh}
          className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
        >
          Actualizar
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {isAdmin() && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    checked={selectedZones.length === accessibleZones.length && accessibleZones.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300"
                  />
                </th>
              )}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Municipio/Zona
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Estado
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Última Actualización
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actualizado Por
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {accessibleZones.map((zoneName) => {
              const zone = zoneStates[zoneName];
              const canEdit = canEditMunicipio(zoneName);
              
              return (
                <tr key={zoneName} className="hover:bg-gray-50">
                  {isAdmin() && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedZones.includes(zoneName)}
                        onChange={() => handleSelectZone(zoneName)}
                        className="rounded border-gray-300"
                      />
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {zoneName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStateColor(zone?.state || 'green')}`}>
                      {getStateText(zone?.state || 'green')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(zone?.updated_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {zone?.updated_by || 'Sistema'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {canEdit ? (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => onZoneStateChange(zoneName, 'green')}
                          className="text-green-600 hover:text-green-900"
                          title="Habilitar"
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => onZoneStateChange(zoneName, 'yellow')}
                          className="text-yellow-600 hover:text-yellow-900"
                          title="Alerta"
                        >
                          ⚠
                        </button>
                        <button
                          onClick={() => onZoneStateChange(zoneName, 'red')}
                          className="text-red-600 hover:text-red-900"
                          title="Suspender"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <span className="text-gray-400">Sin permisos</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {accessibleZones.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No hay zonas disponibles para mostrar.
        </div>
      )}
    </div>
  );
};

export default MunicipiosTable;

