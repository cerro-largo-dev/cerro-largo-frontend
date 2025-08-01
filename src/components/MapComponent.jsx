import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import municipalitiesDataUrl from '../assets/cerro_largo_municipios_2025.geojson?url';
import meloAreaSeriesDataUrl from '../assets/series_cerro_largo.geojson?url';

// Configurar iconos de Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
    iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Colores para estados de camineria (Unicos colores que se mostraran)
const stateColors = {
    green: "#22c55e", // Verde - Habilitado
    yellow: '#eab308', // Amarillo - Alerta
    red: '#ef4444', // Rojo - Suspendido
};

const BACKEND_URL = 'https://cerro-largo-backend.onrender.com/';

function MapComponent({ 
    zoneStates,         // <- RECIBIR COMO PROP
    onZoneStatesLoad,   // <- CALLBACK PARA CARGAR DATOS INICIALES  
    onZoneStateChange,  // <- CALLBACK PARA CAMBIOS DE ESTADO
    onZonesLoad         // <- CALLBACK PARA CARGAR LISTA DE ZONAS
}) {
    const [geoData, setGeoData] = useState(null);
    const [meloAreaGeoData, setMeloAreaGeoData] = useState(null);
    const [zones, setZones] = useState([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    
    const mapCenter = [-32.55, -54.00]; // Coordenadas del centro de Cerro Largo

    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);
                
                // Cargar datos GeoJSON
                const [municipalitiesResponse, meloResponse] = await Promise.all([
                    fetch(municipalitiesDataUrl),
                    fetch(meloAreaSeriesDataUrl)
                ]);

                if (municipalitiesResponse.ok && meloResponse.ok) {
                    const [municipalitiesData, meloData] = await Promise.all([
                        municipalitiesResponse.json(),
                        meloResponse.json()
                    ]);

                    setGeoData(municipalitiesData);
                    setMeloAreaGeoData(meloData);

                    // Extraer nombres de zonas
                    let allZones = [];
                    municipalitiesData.features.forEach((feature) => {
                        const zoneName = feature.properties.municipio;
                        allZones.push(zoneName);
                    });

                    // Agregar zonas del área de Melo
                    meloData.features.forEach((feature) => {
                        const zoneName = `Melo (${feature.properties.serie})`;
                        allZones.push(zoneName);
                    });
                    
                    setZones(allZones);
                    
                    // CAMBIO: Notificar al componente padre sobre las zonas cargadas
                    if (onZonesLoad) {
                        onZonesLoad(allZones);
                    }
                    
                    // Cargar estados de zonas desde el backend
                    await loadZoneStates();
                }
            } catch (error) {
                console.error("Error cargando datos del mapa:", error);
                setMessage({ type: 'error', text: 'Error al cargar datos del mapa' });
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, []); // Carga inicial única

    // useEffect para debugging cuando zoneStates cambia
    useEffect(() => {
        console.log('zoneStates actualizado:', zoneStates);
        console.log('Número de zonas con estado:', Object.keys(zoneStates).length);
    }, [zoneStates]);

    const loadZoneStates = async () => {
        try {
            console.log('Cargando estados de zonas desde:', `${BACKEND_URL}api/admin/zones/states`);
            const response = await fetch(`${BACKEND_URL}api/admin/zones/states`);
            
            if (response.ok) {
                const data = await response.json();
                console.log('Respuesta del backend:', data);
                const stateMap = {};
                
                // Manejar diferentes formatos de respuesta del backend
                if (data.zones && Array.isArray(data.zones)) {
                    console.log('Formato: data.zones array');
                    data.zones.forEach(zone => {
                        stateMap[zone.name] = zone.state;
                    });
                } else if (Array.isArray(data)) {
                    console.log('Formato: array directo');
                    data.forEach(zone => {
                        stateMap[zone.zone_name] = zone.state;
                    });
                } else if (data && typeof data === 'object') {
                    console.log('Formato: objeto directo');
                    // Si es un objeto directo, copiarlo
                    Object.assign(stateMap, data);
                }
                
                console.log('Estados mapeados:', stateMap);
                
                // CAMBIO: Notificar al componente padre en lugar de actualizar estado local
                if (onZoneStatesLoad) {
                    onZoneStatesLoad(stateMap);
                }
            } else {
                console.error("Failed to load zone states:", response.statusText, await response.text());
                setMessage({ type: 'error', text: 'Error al cargar estados de zonas' });
            }
        } catch (error) {
            console.error('Error loading zone states:', error);
            setMessage({ type: 'error', text: 'Error al conectar con el servidor' });
        }
    };

    // Función para recargar datos manualmente
    const reloadMapData = async () => {
        try {
            setLoading(true);
            await loadZoneStates();
            setMessage({ type: 'success', text: 'Mapa actualizado correctamente' });
        } catch (error) {
            console.error('Error reloading map:', error);
            setMessage({ type: 'error', text: 'Error al actualizar mapa' });
        } finally {
            setLoading(false);
        }
    };

    const getFeatureStyle = (feature) => {
        let zoneName;
        if (feature.properties.municipio) {
            zoneName = feature.properties.municipio;
        } else if (feature.properties.serie) {
            zoneName = `Melo (${feature.properties.serie})`;
        }
        
        // Usar zoneStates recibido como prop
        const stateColor = zoneStates[zoneName] || 'green'; // Por defecto verde
        const finalColor = stateColors[stateColor];

        // Debug: Log para verificar los estados
        console.log(`Zona: ${zoneName}, Estado: ${stateColor}, Color: ${finalColor}`);

        return {
            fillColor: finalColor,
            weight: 2,
            opacity: 1,
            color: '#333',
            dashArray: '',
            fillOpacity: 0.6
        };
    };

    const onEachFeature = (feature, layer) => {
        let name, department, area, zoneName;

        if (feature.properties.municipio) {
            name = feature.properties.municipio;
            zoneName = name;
            department = feature.properties.depto;
            area = feature.properties.area_km2 ? feature.properties.area_km2.toFixed(2) : 'N/A';
        } else if (feature.properties.serie) {
            name = `Melo (${feature.properties.serie})`;
            zoneName = name;
            department = feature.properties.depto;
            area = feature.properties.area_km2 ? feature.properties.area_km2.toFixed(2) : 'N/A';
        }

        layer.bindPopup(
            `<b>${name}</b><br>` +
            `Departamento: ${department}<br>` +
            `Área: ${area} km²<br>` +
            `Estado: ${zoneStates[zoneName] || 'verde'}`
        );

        layer.on({
            click: (e) => {
                const oldState = zoneStates[zoneName] || 'green';
                const newState = (oldState === 'green') ? 'yellow' : ((oldState === 'yellow') ? 'red' : 'green');
                
                // CAMBIO: Usar callback del padre en lugar de estado local
                if (onZoneStateChange) {
                    onZoneStateChange(zoneName, newState);
                }
                
                // Enviar estado al backend
                fetch(`${BACKEND_URL}api/admin/zones/update-state`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ zone_name: zoneName, state: newState })
                })
                .then(response => {
                    if (!response.ok) {
                        console.error('Failed to update zone state on backend');
                        setMessage({ type: 'error', text: 'Error al actualizar estado en el servidor' });
                    } else {
                        setMessage({ type: 'success', text: `Estado de ${zoneName} actualizado a ${newState}` });
                    }
                })
                .catch(error => {
                    console.error('Error sending state to backend:', error);
                    setMessage({ type: 'error', text: 'Error de conexión con el servidor' });
                });
            }
        });
    };

    // Función para descargar reporte - disponible para todos los usuarios
    const downloadReport = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${BACKEND_URL}api/report/download`);
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = "none";
                a.href = url;
                a.download = 'reporte_camineria_cerro_largo.pdf';
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                setMessage({ type: 'success', text: 'Reporte descargado correctamente' });
            } else {
                console.error('Failed downloading report');
                setMessage({ type: 'error', text: 'Error al descargar reporte' });
            }
        } catch (error) {
            console.error('Error downloading report:', error);
            setMessage({ type: 'error', text: 'Error al descargar reporte' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative w-full h-screen">
            {/* Mensajes de estado */}
            {message.text && (
                <div className={`absolute top-4 left-4 z-[1000] p-3 rounded-lg ${
                    message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                    {message.text}
                    <button 
                        onClick={() => setMessage({ type: '', text: '' })}
                        className="ml-2 text-sm"
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* Botones de control */}
            <div className="absolute top-4 right-4 z-[1000] flex gap-2 flex-col">
                <div className="flex gap-2">
                    <button
                        onClick={reloadMapData}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-green-700 disabled:opacity-50"
                        disabled={loading}
                    >
                        {loading ? 'Actualizando...' : 'Actualizar Mapa'}
                    </button>
                    
                    <button
                        onClick={downloadReport}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-blue-700 disabled:opacity-50"
                        disabled={loading}
                    >
                        {loading ? 'Descargando...' : 'Descargar Reporte'}
                    </button>
                </div>
                
                {/* Botón de debug */}
                <button
                    onClick={() => {
                        console.log('=== DEBUG INFO ===');
                        console.log('zoneStates:', zoneStates);
                        console.log('zones:', zones);
                        console.log('geoData:', geoData);
                        console.log('meloAreaGeoData:', meloAreaGeoData);
                        // Test: Cambiar una zona aleatoriamente para testing
                        if (zones.length > 0 && onZoneStateChange) {
                            const randomZone = zones[0];
                            console.log(`Probando cambio de ${randomZone} a yellow`);
                            onZoneStateChange(randomZone, 'yellow');
                        }
                    }}
                    className="bg-purple-600 text-white px-2 py-1 text-sm rounded shadow-lg hover:bg-purple-700"
                >
                    Debug Test
                </button>
            </div>

            <MapContainer
                center={mapCenter}
                zoom={9}
                className="leaflet-container"
                style={{ width: '100%', height: '100%' }}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {geoData && geoData.features.length > 0 && (
                    <GeoJSON
                        data={geoData}
                        style={getFeatureStyle}
                        onEachFeature={onEachFeature}
                        key={`municipalities-${Object.keys(zoneStates).length}-${JSON.stringify(zoneStates).slice(0, 50)}`}
                    />
                )}
                {meloAreaGeoData && meloAreaGeoData.features.length > 0 && (
                    <GeoJSON
                        data={meloAreaGeoData}
                        style={getFeatureStyle}
                        onEachFeature={onEachFeature}
                        key={`melo-${Object.keys(zoneStates).length}-${JSON.stringify(zoneStates).slice(0, 50)}`}
                    />
                )}
            </MapContainer>
        </div>
    );
}

export default MapComponent;
