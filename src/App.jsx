import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth.jsx';

const LoginForm = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('admin@cerrolargo.gub.uy');
  const [password, setPassword] = useState('admin2025');
  const [error, setError] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const res = await login(email, password);
    if (!res?.success) setError(res?.message || 'Error de autenticación');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 border rounded-xl p-6">
        <h1 className="text-xl font-semibold">Iniciar sesión</h1>
        <label className="block">
          <span className="text-sm">Email</span>
          <input
            className="w-full border rounded px-3 py-2"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
          />
        </label>
        <label className="block">
          <span className="text-sm">Contraseña</span>
          <input
            className="w-full border rounded px-3 py-2"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button className="w-full rounded-lg px-4 py-2 border hover:bg-gray-50" type="submit">
          Entrar
        </button>
      </form>
    </div>
  );
};

export default function App() {
  const {
    user,
    loading,
    isAuthenticated,
    logout,
    authenticatedFetch,
    isAdmin,
    isAlcalde,
  } = useAuth();

  const [zoneStates, setZoneStates] = useState({});
  const [loadingZones, setLoadingZones] = useState(false);
  const [errorZones, setErrorZones] = useState('');

  const loadZoneStates = async () => {
    setLoadingZones(true);
    setErrorZones('');
    try {
      const res = await authenticatedFetch(
        'https://cerro-largo-backend.onrender.com/api/admin/zones/states'
      );
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const next = {};
      if (data?.states) {
        for (const name in data.states) next[name] = data.states[name]?.state || 'green';
      }
      setZoneStates(next);
    } catch (e) {
      console.error('zones/states error:', e);
      setErrorZones('No se pudieron cargar las zonas.');
    } finally {
      setLoadingZones(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) loadZoneStates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  if (loading) return <div className="p-6">Cargando…</div>;
  if (!isAuthenticated) return <LoginForm />;

  return (
    <div className="min-h-screen p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Panel de Caminería</h1>
          <p className="text-sm text-gray-600">
            Sesión: <strong>{user?.email}</strong> · Rol:{' '}
            <strong>{isAdmin ? 'ADMIN' : isAlcalde ? 'ALCALDE' : user?.role}</strong>
            {user?.municipio_id ? ` · Municipio: ${user.municipio_id}` : ''}
          </p>
        </div>
        <button onClick={logout} className="rounded-lg px-4 py-2 border hover:bg-gray-50">
          Salir
        </button>
      </header>

      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <button
            onClick={loadZoneStates}
            className="rounded-lg px-4 py-2 border hover:bg-gray-50"
            disabled={loadingZones}
          >
            {loadingZones ? 'Actualizando…' : 'Actualizar estados'}
          </button>
          {errorZones && <span className="text-red-600 text-sm">{errorZones}</span>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.keys(zoneStates).length === 0 && !loadingZones && (
            <div className="text-sm text-gray-600">Sin datos.</div>
          )}
          {Object.entries(zoneStates).map(([zone, state]) => (
            <div key={zone} className="border rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">{zone}</p>
                <p className="text-sm text-gray-600">Estado actual</p>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  state === 'green'
                    ? 'bg-green-100 text-green-700'
                    : state === 'yellow'
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-red-100 text-red-700'
                }`}
              >
                {state}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
