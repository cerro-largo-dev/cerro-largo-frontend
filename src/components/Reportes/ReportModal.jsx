import React, { useState, useEffect, useRef, useCallback } from 'react'

const ReportModal = ({ open = false, anchorRect = null, onClose, onLocationChange }) => {
  const panelRef = useRef(null);
  const [stylePos, setStylePos] = useState({ bottom: 84, left: 72 }); // fallback
  const [formData, setFormData] = useState({
    description: '',
    placeName: '',
    latitude: null,
    longitude: null,
    photos: []
  })
  const [isLoadingLocation, setIsLoadingLocation] = useState(false)
  const [locationError, setLocationError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Posición → al costado derecho del botón (similar a InfoPanel)
  const computePos = useCallback(() => {
    if (!anchorRect) return;
    const gap = 12;
    const left = Math.round(anchorRect.right + gap);
    const bottom = Math.round(window.innerHeight - anchorRect.bottom);
    setStylePos({ left, bottom });
  }, [anchorRect]);

  useEffect(() => {
    if (!open) return;
    computePos();
    const onResize = () => computePos();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, { passive: true });
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize);
    };
  }, [open, computePos]);

  // Escape + click-outside
  useEffect(() => {
    if (!open) return;
    const onKey = e => { if (e.key === 'Escape') onClose?.(); };
    const onClickO = e => {
      if (!panelRef.current) return;
      if (!panelRef.current.contains(e.target)) onClose?.();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClickO);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClickO);
    };
  }, [open, onClose]);

  // Obtener geolocalización al abrir el modal
  useEffect(() => {
    if (open) {
      // Solo obtener ubicación si no la tenemos ya
      if (!formData.latitude || !formData.longitude) {
        setLocationError('');
        getLocation();
      }
    }
  }, [open, onLocationChange])

  const getLocation = () => {
    setIsLoadingLocation(true)
    setLocationError('')

    if (!navigator.geolocation) {
      setLocationError('La geolocalización no está soportada en este navegador')
      setIsLoadingLocation(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        
        console.log('Geolocalización obtenida:', { lat, lng });
        
        setFormData(prev => ({
          ...prev,
          latitude: lat,
          longitude: lng
        }))
        
        // Enviar ubicación al padre (se mantiene persistente)
        if (onLocationChange) {
          console.log('ReportModal enviando ubicación al padre:', { lat, lng });
          onLocationChange({ lat, lng });
        }
        
        setIsLoadingLocation(false)
      },
      (error) => {
        console.error('Error de geolocalización:', error);
        
        // Para debug: usar coordenadas de Cerro Largo como fallback
        const fallbackLat = -32.3667;
        const fallbackLng = -54.1667;
        
        console.log('Usando coordenadas de fallback:', { lat: fallbackLat, lng: fallbackLng });
        
        setFormData(prev => ({
          ...prev,
          latitude: fallbackLat,
          longitude: fallbackLng
        }))
        
        // Enviar ubicación de fallback al padre (se mantiene persistente)
        if (onLocationChange) {
          console.log('ReportModal enviando ubicación de fallback al padre:', { lat: fallbackLat, lng: fallbackLng });
          onLocationChange({ lat: fallbackLat, lng: fallbackLng });
        }
        
        let errorMessage = 'Usando ubicación aproximada de Cerro Largo (GPS no disponible)';
        setLocationError(errorMessage);
        
        setIsLoadingLocation(false)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    )
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handlePhotoUpload = (e) => {
    const files = Array.from(e.target.files)
    if (files.length + formData.photos.length > 3) {
      alert('Máximo 3 fotos permitidas')
      return
    }

    setFormData(prev => ({
      ...prev,
      photos: [...prev.photos, ...files]
    }))
  }

  const removePhoto = (index) => {
    setFormData(prev => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index)
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.description.trim()) {
      alert('Por favor, ingresa una descripción')
      return
    }

    setIsSubmitting(true)

    try {
      // Crear FormData para enviar archivos y datos
      const formDataToSend = new FormData()
      formDataToSend.append('descripcion', formData.description)
      formDataToSend.append('nombre_lugar', formData.placeName || '')
      
      if (formData.latitude !== null) {
        formDataToSend.append('latitud', formData.latitude.toString())
      }
      if (formData.longitude !== null) {
        formDataToSend.append('longitud', formData.longitude.toString())
      }
      
      // Agregar fotos
      formData.photos.forEach((photo, index) => {
        formDataToSend.append('fotos', photo)
      })

      // Enviar al backend
      const backendUrl = 'https://cerro-largo-backend.onrender.com/';
      const response = await fetch(`${backendUrl}/api/reportes`, {
        method: 'POST',
        body: formDataToSend
      });

      if (response.ok) {
        const result = await response.json()
        console.log('Reporte creado:', result)
        alert('Reporte enviado exitosamente')
        handleClose()
      } else {
        const error = await response.json()
        console.error('Error del servidor:', error)
        alert(`Error al enviar el reporte: ${error.error || 'Error desconocido'}`)
      }
    } catch (error) {
      console.error('Error de red:', error)
      alert('Error de conexión. Verifica tu conexión a internet e inténtalo de nuevo.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    setFormData({
      description: '',
      placeName: '',
      latitude: null,
      longitude: null,
      photos: []
    })
    setLocationError('')
    
    // Limpiar ubicación en el padre al cerrar el modal
    if (onLocationChange) {
      onLocationChange(null);
    }
    
    // Cerrar el modal
    if (onClose) {
      onClose();
    }
  }

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label="Reportar Estado"
      className="fixed z-[999] bg-white/95 backdrop-blur w-[350px] max-w-[90vw] max-h-[80vh] overflow-y-auto rounded-xl border border-gray-200 shadow-lg"
      style={{ bottom: stylePos.bottom, left: stylePos.left }}
    >
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <h3 className="font-semibold text-gray-800">Reportar Estado</h3>
        <button
          aria-label="Cerrar"
          className="p-1 rounded hover:bg-gray-100"
          onClick={handleClose}
        >
          <svg className="h-5 w-5 text-gray-600" viewBox="0 0 24 24" stroke="currentColor" fill="none">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
        
      <div className="p-4">
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
                <button
                  type="button"
                  onClick={getLocation}
                  className="p-0 h-auto ml-2 text-blue-600 underline bg-transparent border-none cursor-pointer"
                >
                  Reintentar
                </button>
              </div>
            ) : formData.latitude && formData.longitude ? (
              <div className="text-sm text-green-600">
                ✓ Ubicación obtenida: {formData.latitude.toFixed(6)}, {formData.longitude.toFixed(6)}
              </div>
            ) : null}
          </div>

          {/* Nombre del lugar (opcional) */}
          <div className="space-y-2">
            <label htmlFor="placeName" className="text-sm font-medium">Nombre del lugar (opcional)</label>
            <input
              id="placeName"
              name="placeName"
              value={formData.placeName}
              onChange={handleInputChange}
              placeholder="Ej: Curva peligrosa en Ruta 8"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
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
              rows={3}
              maxLength={500}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
            <div className="text-xs text-gray-500 text-right">
              {formData.description.length}/500 caracteres
            </div>
          </div>

          {/* Carga de fotos */}
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
                multiple
                onChange={handlePhotoUpload}
                className="hidden"
                id="photo-upload"
              />
              <button
                type="button"
                onClick={() => document.getElementById('photo-upload').click()}
                disabled={formData.photos.length >= 3}
                className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed bg-white text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Subir fotos
              </button>
              <span className="text-sm text-gray-500">
                {formData.photos.length}/3
              </span>
            </div>
            
            {/* Vista previa de fotos */}
            {formData.photos.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-2">
                {formData.photos.map((photo, index) => (
                  <div key={index} className="relative">
                    <img
                      src={URL.createObjectURL(photo)}
                      alt={`Foto ${index + 1}`}
                      className="w-full h-16 object-cover rounded border"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(index)}
                      className="absolute -top-2 -right-2 h-5 w-5 p-0 rounded-full bg-red-500 text-white border-none cursor-pointer hover:bg-red-600 flex items-center justify-center"
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

          {/* Botones de acción */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 text-sm"
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm"
              disabled={isSubmitting || !formData.description.trim()}
            >
              {isSubmitting ? (
                <>
                  <div className="inline-block animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full mr-2"></div>
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
  )
}

export default ReportModal

