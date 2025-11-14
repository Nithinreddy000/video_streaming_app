import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { hasMinimumRole } from '@/utils/rbac';

interface ProtectedRouteProps {
  children: React.ReactNode;
  minimumRole?: 'viewer' | 'editor' | 'admin';
  redirectTo?: string;
}

/**
 * Protected Route Component
 * Restricts access based on user role
 *
 * @param children - Component to render if authorized
 * @param minimumRole - Minimum role required (default: 'viewer')
 * @param redirectTo - Redirect path if unauthorized (default: '/')
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  minimumRole = 'viewer',
  redirectTo = '/',
}) => {
  const { user, isAuthenticated } = useAuthStore();

  // Not authenticated - redirect to home
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // Check if user has minimum required role
  if (!hasMinimumRole(user.role, minimumRole)) {
    console.warn(`Access denied: User role "${user.role}" does not meet minimum role "${minimumRole}"`);
    return <Navigate to={redirectTo} replace />;
  }

  // Authorized - render children
  return <>{children}</>;
};
