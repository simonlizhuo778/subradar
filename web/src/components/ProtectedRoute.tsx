import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/auth';

export function ProtectedRoute() {
  const { token, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-400">
        加载中…
      </div>
    );
  }

  return token ? <Outlet /> : <Navigate to="/login" replace />;
}
