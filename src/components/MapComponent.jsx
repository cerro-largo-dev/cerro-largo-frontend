import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import municipalitiesDataUrl from '../assets/cerro_largo_municipios_2025.geojson?url';
import meloAreaSeriesDataUrl from '../assets/series_cerro_largo.geojson?url';
import caminosDataUrl from '../assets/camineria_cerro_largo.json?url';
import { getRoadStyle, onEachRoadFeature, createResponsiveRoadStyle } from '../utils/caminosUtils';

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

// Componente para manejar eventos de zoom
function ZoomHandler({ onZoomChange }) {
    const map = useMap();
    
    useEffect(() => {
        const handleZoom = () => {
            onZoomChange(map.getZoom());
        };
        
        map.on('zoomend', handleZoom);
        
        // Establecer zoom inicial
        onZoomChange(map.getZoom());
        
        return () => {
            map.off('zoomend', handleZoom);
        };
    }, [map, onZoomChange]);
    
    return null;
}

function MapComponent({ 
    zoneStates,         // <- RECIBIR COMO PROP
    onZoneStatesLoad,   // <- CALLBACK PARA CARGAR DATOS INICIALES  
    onZoneStateChange,  // <- CALLBACK PARA CAMBIOS DE ESTADO
    onZonesLoad         // <- CALLBACK PARA CARGAR LISTA DE ZONAS
}) {
    const [geoData, setGeoData] = useState(null);
    const [meloAreaGeoData, setMeloAreaGeoData] = useState(null);
    const [caminosData, setCaminosData] = useState(null);
    const [zones, setZones] = useState([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [currentZoom, setCurrentZoom] = useState(9);
    const mapRef = useRef(null);
    
    const mapCenter = [-32.55, -54.00]; // Coordenadas del centro de Cerro Largo

    // Función para actualizar el zoom
    const handleZoomChange = (newZoom) => {
        setCurrentZoom(newZoom);
    };

    // Función de estilo que depende del zoom actual
    const getRoadStyleWithZoom = (feature) => {
        return getRoadStyle(feature, currentZoom);
    };

    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);
                
                // Cargar datos GeoJSON
                const [municipalitiesResponse, meloResponse, caminosResponse] = await Promise.all([
                    fetch(municipalitiesDataUrl),
                    fetch(meloAreaSeriesDataUrl),
                    fetch(caminosDataUrl)
                ]);

                if (municipalitiesResponse.ok && meloResponse.ok && caminosResponse.ok) {
                    const [municipalitiesData, meloData, caminosDataJson] = await Promise.all([
                        municipalitiesResponse.json(),
                        meloResponse.json(),
                        caminosResponse.json()
                    ]);

                    setGeoData(municipalitiesData);
                    setMeloAreaGeoData(meloData);
                    setCaminosData(caminosDataJson);

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

    const loadZoneStates = async () => {
        try {
            const response = await fetch(`${BACKEND_URL}api/admin/zones/states`);
            if (response.ok) {
                const data = await response.json();
                const stateMap = {};
                // Manejar el formato de respuesta del backend (diccionario de estados)
                if (data.states) {
                    for (const zoneName in data.states) {
                        stateMap[zoneName] = data.states[zoneName].state;
                    }
                }
                
                // CAMBIO: Notificar al componente padre en lugar de actualizar estado local
                if (onZoneStatesLoad) {
                    onZoneStatesLoad(stateMap);
                }
            } else {
                console.error("Failed to load zone states:", response.statusText);
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
            // setMessage({ type: 'success', text: 'Mapa actualizado correctamente' }); // Removido para evitar notificaciones innecesarias
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

        return {
            fillColor: finalColor,
            weight: 2,
            opacity: 0.9, // Borde con alta opacidad
            color: #18392B, // Mismo color que el relleno
            dashArray: '',
            fillOpacity: 0.6 // Relleno con menor opacidad
        };
    };

    const getStateLabel = (state) => {
        switch (state) {
            case 'green': return 'Habilitado';
            case 'yellow': return 'Alerta';
            case 'red': return 'Suspendido';
            default: return 'Desconocido';
        }
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
            `Estado: ${zoneStates[zoneName] ? getStateLabel(zoneStates[zoneName]) : 'Desconocido'}`
        );

        layer.on({
            mouseover: (e) => {
                e.target.setStyle({
                    fillOpacity: 0.8
                });
            },
            mouseout: (e) => {
                e.target.setStyle({
                    fillOpacity: 0.4
                });
            },
            click: (e) => {
                // La lógica de cambio de estado al hacer clic ha sido eliminada
                // ya que esta funcionalidad debe ser manejada exclusivamente por el panel de administración.
                // Los cambios de estado ahora solo se reflejarán desde el backend.
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
                // setMessage({ type: 'success', text: 'Reporte descargado correctamente' }); // Removido para evitar notificaciones innecesarias
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
            <div className="absolute top-4 right-4 z-[1000] flex gap-2">
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
                        key={`municipalities-${JSON.stringify(zoneStates)}`}
                    />
                )}
                {meloAreaGeoData && meloAreaGeoData.features.length > 0 && (
                    <GeoJSON
                        data={meloAreaGeoData}
                        style={getFeatureStyle}
                        onEachFeature={onEachFeature}
                        key={`melo-${JSON.stringify(zoneStates)}`}
                    />
                )}
                {caminosData && caminosData.features.length > 0 && (
                    <GeoJSON
                        data={caminosData}
                        style={getRoadStyleWithZoom}
                        onEachFeature={onEachRoadFeature}
                        key={`caminos-layer-zoom-${currentZoom}`}
                        pathOptions={{
                            interactive: true,
                            bubblingMouseEvents: false
                        }}
                    />
                )}
                <ZoomHandler onZoomChange={handleZoomChange} />
            </MapContainer>
        </div>
    );
}

export default MapComponent;
