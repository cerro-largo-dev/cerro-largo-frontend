import { useAuth } from './useAuth.jsx';

export const useRole = () => {
  const { user, isAuthenticated, loading } = useAuth();

  const role = user?.role;
  const municipio = user?.municipio_id ?? null;

  const isAdmin = () => !loading && isAuthenticated && role === 'ADMIN';
  const isAlcalde = () => !loading && isAuthenticated && role === 'ALCALDE';

  const hasRole = (r) => !loading && isAuthenticated && role === r;
  const hasAnyRole = (roles = []) => !loading && isAuthenticated && roles.includes(role);

  const canAccessMunicipio = (municipioId) => {
    if (loading || !isAuthenticated) return false;
    if (isAdmin()) return true;
    return isAlcalde() && municipio === municipioId;
  };

  const canEditMunicipio = canAccessMunicipio;

  const getMunicipioFromToken = () => municipio;

  const getAccessibleMunicipios = (allMunicipios = []) => {
    if (loading || !isAuthenticated) return [];
    if (isAdmin()) return allMunicipios;
    if (isAlcalde() && municipio) return allMunicipios.filter((m) => m === municipio);
    return [];
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
    currentRole: role,
    currentMunicipio: municipio,
  };
};
