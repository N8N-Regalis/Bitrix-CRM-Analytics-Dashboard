import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/components/layout/AuthProvider';

export function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();

  if (status !== 'authenticated') {
    // Remember where they were headed so Login can send them back there.
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
