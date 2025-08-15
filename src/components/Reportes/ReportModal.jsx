import { useState, useEffect, useRef } from 'react';

const ReportModal = ({ isOpen, onClose, onLocationChange, onEnsureLocation }) => {
  const [formData, setFormData] = useState({
    description: '',
    placeName: '',
    latitude: null,
    longitude: null,
    photos: []
  });
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastGeoErrorCode, setLastGeoErrorCode] = useState(null);

  const watchIdRef = useRef(null);
  const timerRef = useRef(null);

  const BACKEND_URL = (
    (typeof window !== 'undefined' && window.BACKEND_URL) ||
    (typeof import.meta !== 'undefined' && import.meta.env &&
      (import.meta.env.VITE_REACT_APP_BACKEND_URL || import.meta.env.VITE_BACKEND_URL)) ||
    'https://cerro-largo-backend.onrender.com'
  ).replace(/\/$/, '');

  useEffect(() => {
    if (isOpen) {
      setLocationError('');
      if (!formData.latitude || !formData.longitude) {
        getLocation(); // primer intento normal
      }
      // además, pedile al padre que reintente (gesto del usuario)
      typeof onEnsureLocation === 'function' && onEnsureLocation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && navigator.geolocation?.clearWatch) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      clearTimeout(timerRef.current);
    };
  }, []);

  const setCoords = (lat, lng) => {
    setFormData(prev => ({ ...prev, latitude: lat, longitude: lng }));
    onLocationChange && onLocationChange({ lat, lng });
  };

  const useFallback = (msg) => {
    setCoords(-32.3667, -54.1667);
    setLocationError(msg || 'Usando ubicación aproximada de Cerro Largo (GPS no disponible)');
  };

  const tryOnce = (opts) =>
    new Promise((resolve, reject) => {
      if (!('geolocation' in navigator)) return reject(new Error('No geolocation'));
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => reject(err),
        opts
      );
    });

  const tryWatch = (opts, ms = 8000) =>
    new Promise((resolve, reject) => {
      if (!('geolocation' in navigator) || !navigator.geolocation.watchPosition) {
        return reject(new Error('No watch'));
      }
      let resolved = false;
      const id = navigator.geolocation.watchPosition(
        (pos) => {
          if (resolved) return;
          resolved = true;
          navigator.geolocation.clearWatch(id);
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        (err) => {
          if (resolved) return;
          resolved = true;
          navigator.geolocation.clearWatch(id);
          reject(err);
        },
        opts
      );
      setTimeout(() => {
        if (resolved) return;
        resolved = true;
        navigator.geolocation.clearWatch(id);
        reject(new Error('watch timeout'));
      }, ms);
    });

  const getLocation = async (compat = false) => {
    setIsLoadingLocation(true);
    setLocationError('');
    setLastGeoErrorCode(null);

    if (!('geolocation' in navigator)) {
      setIsLoadingLocation(false);
      return useFallback('Geolocalización no soportada por el navegador');
    }

    try {
      if (compat) {
        // Modo compatibilidad: baja precisión + watch fallback
        try {
          const loc2 = await tryOnce({ enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 });
          setCoords(loc2.lat, loc2.lng);
          setIsLoadingLocation(false);
          return;
        } catch (e2) {
          setLastGeoErrorCode(e2 && e2.code);
          try {
            const loc3 = await tryWatch({ enableHighAccuracy: false, maximumAge: 300000 }, 10000);
            setCoords(loc3.lat, loc3.lng);
            setIsLoadingLocation(false);
            return;
          } catch {
            useFallback();
            setIsLoadingLocation(false);
            return;
          }
        }
      } else {
        // Intento normal: alta precisión → baja precisión → watch
        try {
          const loc = await tryOnce({ enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 });
          setCoords(loc.lat, loc.lng);
          setIsLoadingLocation(false);
          return;
        } catch (e1) {
          setLastGeoErrorCode(e1 && e1.code);
          if (e1 && e1.code === 2) {
            // POSITION_UNAVAILABLE → pruebo baja precisión
            try {
              const loc2 = await tryOnce({ enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 });
              setCoords(loc2.lat, loc2.lng);
              setIsLoadingLocation(false);
              return;
            } catch (e2) {
              setLastGeoErrorCode(e2 && e2.code);
              const loc3 = await tryWatch({ enableHighAccuracy: false, maximumAge: 300000 }, 10000).catch(() => null);
              if (loc3) {
                setCoords(loc3.lat, loc3.lng);
                setIsLoadingLocation(false);
                return;
              }
              useFallback();
              setIsLoadingLocation(false);
              return;
            }
          } else {
            // denied/timeout u otro
            useFallback();
            setIsLoadingLocation(false);
            return;
          }
        }
      }
    } catch {
      useFallback();
      setIsLoadingLocation(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePhotoUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length + formData.photos.length > 3) {
      alert('Máximo 3 fotos permitidas');
      return;
    }
    setFormData(prev => ({ ...prev, photos: [...prev.photos, ...files] }));
  };

  const removePhoto = (index) => {
    setFormData(prev => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.description.trim()) {
      alert('Por favor, ingresa una descripción');
      return;
    }
    setIsSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('descripcion', formData.description);
      fd.append('nombre_lugar', formData.placeName || '');
      if (formData.latitude !== null) fd.append('latitud', String(formData.latitude));
      if (formData.longitude !== null) fd.append('longitud', String(formData.longitude));
      formData.photos.forEach((p) => fd.append('fotos', p));

      const res = await fetch(`${BACKEND_URL}/api/reportes`, {
        method: 'POST',
        body: fd,
        credentials: 'include'
      });
      if (res.ok) {
        await res.json().catch(() => ({}));
        alert('Reporte enviado exitosamente');
        handleClose();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`Error al enviar el reporte: ${err.error || 'Error desconocido'}`);
      }
    } catch {
      alert('Error de conexión. Inténtalo de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setFormData({
      description: '',
      placeName: '',
      latitude: null,
      longitude: null,
      photos: []
    });
    setLocationError('');
    onLocationChange && onLocationChange(null);
    onClose && onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-6 left-24 z-[1000] p-4">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-white rounded-lg shadow-lg border">
        <div className="flex flex-row items-center justify-between space-y-0 pb-4 p-6 border-b">
          <h3 className="text-lg font-semibold">Reportar Estado</h3>
          <button onClick={handleClose} className="h-8 w-8 p-0 bg-transparent border-none cursor-pointer text-gray-500 hover:text-gray-700">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Geolocalización */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Ubicación
              </label>

              {isLoadingLocation ? (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                  Obteniendo ubicación...
                </div>
              ) : locationError ? (
                <div className="text-sm text-red-600">
                  {locationError}
                  {lastGeoErrorCode === 2 && (
                    <span className="block text-xs text-slate-600 mt-1">
                      (No hay señal GPS/Wi-Fi útil. Probamos un modo de compatibilidad.)
                    </span>
                  )}
                  <div className="mt-1 flex gap-3">
                    <button
                      type="button"
                      onClick={() => getLocation(true)} // compat
                      className="p-0 h-auto text-blue-600 underline bg-transparent border-none cursor-pointer"
                    >
                      Reintentar (compatibilidad)
                    </button>
                    <button
                      type="button"
                      onClick={() => getLocation(false)} // normal
                      className="p-0 h-auto text-blue-600 underline bg-transparent border-none cursor-pointer"
                    >
                      Reintentar (normal)
                    </button>
                  </div>
                </div>
              ) : formData.latitude && formData.longitude ? (
                <div className="text-sm text-green-600">
                  ✓ Ubicación: {formData.latitude.toFixed(6)}, {formData.longitude.toFixed(6)}
                </div>
              ) : null}
            </div>

            {/* Nombre del lugar */}
            <div className="space-y-2">
              <label htmlFor="placeName" className="text-sm font-medium">Nombre del lugar (opcional)</label>
              <input
                id="placeName"
                name="placeName"
                value={formData.placeName}
                onChange={handleInputChange}
                placeholder="Ej: Curva peligrosa en Ruta 8"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Descripción */}
            <div className="space-y-2">
              <label htmlFor="description" className="text-sm font-medium">Descripción *</label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Describe el estado de la caminería o el problema que observas..."
                rows={4}
                maxLength={500}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="text-xs text-gray-500 text-right">
                {formData.description.length}/500 caracteres
              </div>
            </div>

            {/* Fotos */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Fotos (máximo 3)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  onChange={handlePhotoUpload}
                  className="hidden"
                  id="photo-upload"
                />
                <button
                  type="button"
                  onClick={() => document.getElementById('photo-upload').click()}
                  disabled={formData.photos.length >= 3}
                  className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed bg-white"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Usar cámara / subir
                </button>
                <span className="text-sm text-gray-500">{formData.photos.length}/3</span>
              </div>

              {formData.photos.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {formData.photos.map((photo, index) => (
                    <div key={index} className="relative">
                      <img src={URL.createObjectURL(photo)} alt={`Foto ${index + 1}`} className="w-full h-20 object-cover rounded border" />
                      <button
                        type="button"
                        onClick={() => removePhoto(index)}
                        className="absolute -top-2 -right-2 h-6 w-6 p-0 rounded-full bg-red-500 text-white border-none cursor-pointer hover:bg-red-600 flex items-center justify-center"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Botones */}
            <div className="flex gap-2 pt-4">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                disabled={isSubmitting}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                disabled={isSubmitting || !formData.description.trim()}
              >
                {isSubmitting ? (
                  <>
                    <div className="inline-block animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                    Enviando...
                  </>
                ) : (
                  'Enviar Reporte'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ReportModal;
