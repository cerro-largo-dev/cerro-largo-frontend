import React, { useState, useEffect } from 'react';

const BACKEND_URL = 'https://cerro-largo-backend.onrender.com/';

function AdminPanel({ 
    zoneStates,           // <- RECIBIR ESTADO COMPARTIDO
    onZoneStateChange,    // <- CALLBACK PARA CAMBIOS INDIVIDUALES
    onBulkUpdate,         // <- CALLBACK PARA CAMBIOS MÚLTIPLES
    zones                 // <- LISTA DE ZONAS DISPONIBLES
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [loading, setLoading] = useState(false);
    const [selectedZones, setSelectedZones] = useState([]);
    const [bulkState, setBulkState] = useState('green');
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');
    const [showLoginModal, setShowLoginModal] = useState(false);

    // Verificar autenticación al cargar el componente
    useEffect(() => {
        checkAuthentication();
    }, []);

    const checkAuthentication = async () => {
        try {
            const response = await fetch(`${BACKEND_URL}api/admin/check-auth`, {
                credentials: 'include'
            });
            if (response.ok) {
                const data = await response.json();
                setIsAuthenticated(data.authenticated);
            }
        } catch (error) {
            console.error('Error checking authentication:', error);
        }
    };

    const handleLogin = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${BACKEND_URL}api/admin/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ password })
            });

            if (response.ok) {
                setIsAuthenticated(true);
                setShowLoginModal(false);
                setPassword('');
                setMessage({ type: 'success', text: 'Autenticación exitosa' });
            } else {
                setMessage({ type: 'error', text: 'Contraseña incorrecta' });
            }
        } catch (error) {
            console.error('Error during login:', error);
            setMessage({ type: 'error', text: 'Error al autenticar' });
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        try {
            await fetch(`${BACKEND_URL}api/admin/logout`, {
                method: 'POST',
                credentials: 'include'
            });
            setIsAuthenticated(false);
            setIsOpen(false);
            setMessage({ type: 'success', text: 'Sesión cerrada' });
        } catch (error) {
            console.error('Error during logout:', error);
        }
    };

    // Actualizar estado de zona individual
    const handleZoneStateUpdate = async (zoneName, newState) => {
        if (!isAuthenticated) {
            setShowLoginModal(true);
            return;
        }

        try {
            setLoading(true);
            const response = await fetch(`${BACKEND_URL}api/admin/zones/update-state`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    zone_name: zoneName,
                    state: newState
                })
            });

            if (response.ok) {
                // Sincronizar con el estado compartido
                if (onZoneStateChange) {
                    onZoneStateChange(zoneName, newState);
                }
                setMessage({ type: 'success', text: `Estado de ${zoneName} actualizado a ${newState}` });
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Error al actualizar estado de zona');
            }
        } catch (error) {
            console.error('Error updating zone state:', error);
            setMessage({ type: 'error', text: error.message || 'Error al actualizar estado de zona' });
        } finally {
            setLoading(false);
        }
    };

    // Actualización múltiple de zonas
    const handleBulkZoneUpdate = async () => {
        if (!isAuthenticated) {
            setShowLoginModal(true);
            return;
        }

        if (selectedZones.length === 0) {
            setMessage({ type: 'error', text: 'Selecciona al menos una zona' });
            return;
        }

        try {
            setLoading(true);
            const updates = selectedZones.map(zoneName => ({
                zone_name: zoneName,
                state: bulkState
            }));

            const response = await fetch(`${BACKEND_URL}api/admin/zones/bulk-update`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({ updates })
            });

            if (response.ok) {
                // Convertir updates array a objeto para el estado
                const updatedStates = {};
                updates.forEach(update => {
                    updatedStates[update.zone_name] = update.state;
                });

                // Sincronizar con el estado compartido
                if (onBulkUpdate) {
                    onBulkUpdate(updatedStates);
                }
                
                setMessage({ type: 'success', text: `${selectedZones.length} zonas actualizadas correctamente` });
                setSelectedZones([]);
                setShowBulkModal(false);
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Error en actualización múltiple');
            }
        } catch (error) {
            console.error('Error in bulk update:', error);
            setMessage({ type: 'error', text: error.message || 'Error en actualización múltiple' });
        } finally {
            setLoading(false);
        }
    };

    const handleZoneSelection = (zoneName, isSelected) => {
        if (isSelected) {
            setSelectedZones(prev => [...prev, zoneName]);
        } else {
            setSelectedZones(prev => prev.filter(zone => zone !== zoneName));
        }
    };

    const selectAllZones = () => {
        setSelectedZones([...zones]);
    };

    const deselectAllZones = () => {
        setSelectedZones([]);
    };

    const getStateColor = (state) => {
        switch (state) {
            case 'green': return '#22c55e';
            case 'yellow': return '#eab308';
            case 'red': return '#ef4444';
            default: return '#22c55e';
        }
    };

    const getStateLabel = (state) => {
        switch (state) {
            case 'green': return 'Habilitado';
            case 'yellow': return 'Alerta';
            case 'red': return 'Suspendido';
            default: return 'Habilitado';
        }
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-4 left-4 z-[1000] bg-indigo-600 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-indigo-700"
            >
                Panel Administración
            </button>
        );
    }

    return (
        <>
            <div className="fixed bottom-4 left-4 top-4 w-80 bg-white shadow-xl rounded-lg z-[1000] overflow-hidden">
                <div className="bg-indigo-600 text-white p-4 flex justify-between items-center">
                    <h2 className="text-lg font-semibold">Panel de Administración</h2>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="text-white hover:text-gray-200"
                    >
                        ✕
                    </button>
                </div>

                <div className="p-4 h-full overflow-y-auto" style={{ maxHeight: 'calc(100vh - 120px)' }}>
                    {/* Mensajes */}
                    {message.text && (
                        <div className={`mb-4 p-3 rounded ${
                            message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                            {message.text}
                            <button 
                                onClick={() => setMessage({ type: '', text: '' })}
                                className="ml-2 text-sm font-bold"
                            >
                                ✕
                            </button>
                        </div>
                    )}

                    {/* Estado de autenticación */}
                    <div className="mb-4 p-3 bg-gray-100 rounded">
                        {isAuthenticated ? (
                            <div className="flex justify-between items-center">
                                <span className="text-green-600">✓ Autenticado</span>
                                <button
                                    onClick={handleLogout}
                                    className="text-sm bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600"
                                >
                                    Cerrar Sesión
                                </button>
                            </div>
                        ) : (
                            <div className="text-center">
                                <span className="text-red-600">✗ No autenticado</span>
                                <button
                                    onClick={() => setShowLoginModal(true)}
                                    className="block w-full mt-2 bg-indigo-500 text-white px-3 py-2 rounded hover:bg-indigo-600"
                                >
                                    Iniciar Sesión
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Acciones de administración */}
                    {isAuthenticated && (
                        <>
                            <div className="mb-4">
                                <div className="flex gap-2 mb-2">
                                    <button
                                        onClick={selectAllZones}
                                        className="text-sm bg-gray-500 text-white px-2 py-1 rounded hover:bg-gray-600"
                                    >
                                        Seleccionar Todas
                                    </button>
                                    <button
                                        onClick={deselectAllZones}
                                        className="text-sm bg-gray-500 text-white px-2 py-1 rounded hover:bg-gray-600"
                                    >
                                        Deseleccionar
                                    </button>
                                </div>
                                
                                {selectedZones.length > 0 && (
                                    <button
                                        onClick={() => setShowBulkModal(true)}
                                        className="w-full bg-orange-500 text-white px-3 py-2 rounded hover:bg-orange-600"
                                    >
                                        Actualizar {selectedZones.length} zonas
                                    </button>
                                )}
                            </div>

                            {/* Lista de zonas */}
                            <div className="space-y-2">
                                <h3 className="font-semibold text-gray-700">Estados de Zonas:</h3>
                                {zones.map((zoneName) => (
                                    <div key={zoneName} className="border rounded p-2">
                                        <div className="flex items-center mb-2">
                                            <input
                                                type="checkbox"
                                                checked={selectedZones.includes(zoneName)}
                                                onChange={(e) => handleZoneSelection(zoneName, e.target.checked)}
                                                className="mr-2"
                                            />
                                            <span className="text-sm font-medium flex-1">{zoneName}</span>
                                            <div 
                                                className="w-4 h-4 rounded-full"
                                                style={{ backgroundColor: getStateColor(zoneStates[zoneName] || 'green') }}
                                            ></div>
                                        </div>
                                        
                                        <div className="text-xs text-gray-600 mb-2">
                                            Estado: {getStateLabel(zoneStates[zoneName] || 'green')}
                                        </div>
                                        
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => handleZoneStateUpdate(zoneName, 'green')}
                                                className="flex-1 text-xs bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600 disabled:opacity-50"
                                                disabled={loading || zoneStates[zoneName] === 'green'}
                                            >
                                                Habilitar
                                            </button>
                                            <button
                                                onClick={() => handleZoneStateUpdate(zoneName, 'yellow')}
                                                className="flex-1 text-xs bg-yellow-500 text-white px-2 py-1 rounded hover:bg-yellow-600 disabled:opacity-50"
                                                disabled={loading || zoneStates[zoneName] === 'yellow'}
                                            >
                                                Alerta
                                            </button>
                                            <button
                                                onClick={() => handleZoneStateUpdate(zoneName, 'red')}
                                                className="flex-1 text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 disabled:opacity-50"
                                                disabled={loading || zoneStates[zoneName] === 'red'}
                                            >
                                                Suspender
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Modal de login */}
            {showLoginModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1001]">
                    <div className="bg-white p-6 rounded-lg w-80">
                        <h3 className="text-lg font-semibold mb-4">Autenticación de Administrador</h3>
                        <input
                            type="password"
                            placeholder="Contraseña"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full p-2 border rounded mb-4"
                            onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={handleLogin}
                                className="flex-1 bg-indigo-500 text-white px-4 py-2 rounded hover:bg-indigo-600 disabled:opacity-50"
                                disabled={loading}
                            >
                                {loading ? 'Autenticando...' : 'Ingresar'}
                            </button>
                            <button
                                onClick={() => setShowLoginModal(false)}
                                className="flex-1 bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de actualización múltiple */}
            {showBulkModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1001]">
                    <div className="bg-white p-6 rounded-lg w-80">
                        <h3 className="text-lg font-semibold mb-4">Actualización Múltiple</h3>
                        <p className="mb-4">Actualizar {selectedZones.length} zonas seleccionadas al estado:</p>
                        <select
                            value={bulkState}
                            onChange={(e) => setBulkState(e.target.value)}
                            className="w-full p-2 border rounded mb-4"
                        >
                            <option value="green">Habilitado</option>
                            <option value="yellow">Alerta</option>
                            <option value="red">Suspendido</option>
                        </select>
                        <div className="flex gap-2">
                            <button
                                onClick={handleBulkZoneUpdate}
                                className="flex-1 bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600 disabled:opacity-50"
                                disabled={loading}
                            >
                                {loading ? 'Actualizando...' : 'Actualizar'}
                            </button>
                            <button
                                onClick={() => setShowBulkModal(false)}
                                className="flex-1 bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default AdminPanel;
