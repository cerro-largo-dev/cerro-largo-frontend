// src/components/Reportes/ReportModal.jsx
import React, { useEffect, useState } from "react";

function getBackendUrl() {
  const fromWin =
    typeof window !== "undefined" && window.BACKEND_URL ? String(window.BACKEND_URL) : "";
  const envVal =
    (typeof import.meta !== "undefined" &&
      import.meta.env &&
      (import.meta.env.VITE_REACT_APP_BACKEND_URL || import.meta.env.VITE_BACKEND_URL)) ||
    (typeof process !== "undefined" &&
      process.env &&
      (process.env.REACT_APP_BACKEND_URL || process.env.VITE_BACKEND_URL)) ||
    "";
  return (fromWin || envVal || "https://cerro-largo-backend.onrender.com").replace(/\/$/, "");
}

const ReportModal = ({ open, onClose, onLocationChange, anchorRect }) => {
  const [formData, setFormData] = useState({
    description: "",
    placeName: "",
    latitude: null,
    longitude: null,
    photos: [],
  });
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Geolocalización SOLO al abrir el panel
  useEffect(() => {
    if (open) {
      if (!formData.latitude || !formData.longitude) {
        setLocationError("");
        getLocation();
      }
    }
    // no reintentar por cada render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const getLocation = () => {
    setIsLoadingLocation(true);
    setLocationError("");

    if (!navigator.geolocation) {
      setLocationError("La geolocalización no está soportada en este navegador");
      setIsLoadingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setFormData((prev) => ({ ...prev, latitude: lat, longitude: lng }));
        onLocationChange && onLocationChange({ lat, lng });
        setIsLoadingLocation(false);
      },
      () => {
        // Fallback: Cerro Largo
        const fallbackLat = -32.3667;
        const fallbackLng = -54.1667;
        setFormData((prev) => ({ ...prev, latitude: fallbackLat, longitude: fallbackLng }));
        onLocationChange && onLocationChange({ lat: fallbackLat, lng: fallbackLng });
        setLocationError("Usando ubicación aproximada de Cerro Largo (GPS no disponible)");
        setIsLoadingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePhotoUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length + formData.photos.length > 3) {
      alert("Máximo 3 fotos permitidas");
      return;
    }
    setFormData((prev) => ({ ...prev, photos: [...prev.photos, ...files] }));
  };

  const removePhoto = (idx) => {
    setFormData((prev) => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== idx),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.description.trim()) {
      alert("Por favor, ingresa una descripción");
      return;
    }

    setIsSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("descripcion", formData.description);
      fd.append("nombre_lugar", formData.placeName || "");
      if (formData.latitude !== null) fd.append("latitud", String(formData.latitude));
      if (formData.longitude !== null) fd.append("longitud", String(formData.longitude));
      formData.photos.forEach((p) => fd.append("fotos", p));

      const backend = getBackendUrl();
      const resp = await fetch(`${backend}/api/reportes`, { method: "POST", body: fd });

      if (!resp.ok) {
        let errTxt = "";
        try {
          const j = await resp.json();
          errTxt = j?.error || "";
        } catch {}
        throw new Error(errTxt || `HTTP ${resp.status}`);
      }

      // éxito
      alert("Reporte enviado exitosamente");
      handleClose();
    } catch (err) {
      alert(`Error al enviar el reporte${err?.message ? `: ${err.message}` : ""}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    // limpiar estado y notificar al mapa
    setFormData({ description: "", placeName: "", latitude: null, longitude: null, photos: [] });
    setLocationError("");
    onLocationChange && onLocationChange(null);
    onClose && onClose();
  };

  if (!open) return null;

  // Posicionamiento relativo al botón flotante (anchorRect)
  const getModalPosition = () => {
    const base = { position: "fixed", bottom: "1rem", left: "5.25rem", zIndex: 1000 };
    if (!anchorRect) return base;

    const modalWidth = 384; // ~24rem
    const pad = 16;
    let leftPos = anchorRect.right + pad;
    if (leftPos + modalWidth > window.innerWidth) {
      leftPos = Math.max(pad, anchorRect.left - modalWidth - pad);
    }
    const bottom = Math.max(pad, window.innerHeight - anchorRect.bottom);
    return { position: "fixed", left: `${leftPos}px`, bottom: `${bottom}px`, zIndex: 1000 };
  };

  const modalStyle = getModalPosition();

  return (
    <div className="p-4" style={modalStyle}>
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-white rounded-lg shadow-lg border">
        {/* Header */}
        <div className="flex flex-row items-center justify-between space-y-0 pb-4 p-6 border-b">
          <h3 className="text-lg font-semibold">Reportar Estado</h3>
          <button
            onClick={handleClose}
            className="h-8 w-8 p-0 bg-transparent border-none cursor-pointer text-gray-500 hover:text-gray-700"
            aria-label="Cerrar"
            title="Cerrar"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Ubicación */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
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
                  ✓ Ubicación: {formData.latitude.toFixed(6)}, {formData.longitude.toFixed(6)}
                </div>
              ) : null}
            </div>

            {/* Nombre del lugar */}
            <div className="space-y-2">
              <label htmlFor="placeName" className="text-sm font-medium">
                Nombre del lugar
              </label>
              <input
                id="placeName"
                name="placeName"
                value={formData.placeName}
                onChange={handleInputChange}
                placeholder="Ej: Paraje Arriera"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Descripción */}
            <div className="space-y-2">
              <label htmlFor="description" className="text-sm font-medium">
                Descripción
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Describe el problema... Ej: Puente cortado"
                rows={3}
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
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                  />
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
                  onClick={() => document.getElementById("photo-upload").click()}
                  disabled={formData.photos.length >= 3}
                  className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed bg-white"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Subir fotos
                </button>
                <span className="text-sm text-gray-500">{formData.photos.length}/3</span>
              </div>

              {formData.photos.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {formData.photos.map((photo, idx) => (
                    <div key={idx} className="relative">
                      <img
                        src={URL.createObjectURL(photo)}
                        alt={`Foto ${idx + 1}`}
                        className="w-full h-20 object-cover rounded border"
                      />
                      <button
                        type="button"
                        onClick={() => removePhoto(idx)}
                        className="absolute -top-2 -right-2 h-6 w-6 p-0 rounded-full bg-red-500 text-white border-none cursor-pointer hover:bg-red-600 flex items-center justify-center"
                        aria-label="Quitar foto"
                        title="Quitar foto"
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

            {/* Acciones */}
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
                  "Enviar"
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

