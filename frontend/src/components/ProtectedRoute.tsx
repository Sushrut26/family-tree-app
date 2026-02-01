import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { UserRole } from '../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  adminOnly?: boolean;
}

export function ProtectedRoute({ children, adminOnly = false }: ProtectedRouteProps) {
  const { user, token, familySessionId } = useAuthStore();

  // Check if user is authenticated
  if (!user || !token) {
    return <Navigate to="/login" replace />;
  }

  // Check if family password is verified
  if (!familySessionId) {
    // User is authenticated but hasn't verified family password yet
    // The modal will be shown automatically by the auth store
    return <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h2 className="text-2xl font-semibold mb-2">Family Password Required</h2>
        <p className="text-muted">Please verify the family password to continue.</p>
      </div>
    </div>;
  }

  // Check admin access if required
  if (adminOnly && user.role !== UserRole.ADMIN) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
