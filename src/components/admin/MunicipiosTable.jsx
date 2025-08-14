import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.jsx';
import { useRole } from '../../hooks/useRole';

const RouteGuard = ({ children, requiredRoles = [], redirectTo = '/login' }) => {
  const { isAuthenticated, loading } = useAuth();
  const { hasAnyRole } = useRole();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  if (requiredRoles.length > 0 && !hasAnyRole(requiredRoles)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Acceso Denegado</h1>
          <p className="text-gray-600 mb-4">No tienes permisos para acceder a esta página.</p>
          <button
            onClick={() => window.history.back()}
            className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
          >
            Volver
          </button>
        </div>
      </div>
    );
  }

  return children;
};

export default RouteGuard;
  );
};

export default MunicipiosTable;
