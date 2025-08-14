import { useAuth } from './useAuth';

export const useRole = () => {
  const { user, isAuthenticated } = useAuth();

  const isAdmin = () => {
    return isAuthenticated && user?.role === 'ADMIN';
  };

  const isAlcalde = () => {
    return isAuthenticated && user?.role === 'ALCALDE';
  };

  const getMunicipioFromToken = () => {
    return user?.municipio_id || null;
  };

  const canAccessMunicipio = (municipioId) => {
    if (isAdmin()) return true;
    if (isAlcalde()) return user?.municipio_id === municipioId;
    return false;
  };

  const canEditMunicipio = (municipioId) => {
    return canAccessMunicipio(municipioId);
  };

  const getAccessibleMunicipios = (allMunicipios) => {
    if (isAdmin()) return allMunicipios;
    if (isAlcalde() && user?.municipio_id) {
      return allMunicipios.filter(municipio => municipio === user.municipio_id);
    }
    return [];
  };

  const hasRole = (role) => {
    return isAuthenticated && user?.role === role;
  };

  const hasAnyRole = (roles) => {
    return isAuthenticated && roles.includes(user?.role);
  };

  return {
    isAdmin,
    isAlcalde,
    getMunicipioFromToken,
    canAccessMunicipio,
    canEditMunicipio,
    getAccessibleMunicipios,
    hasRole,
    hasAnyRole,
    currentRole: user?.role,
    currentMunicipio: user?.municipio_id,
  };
};
