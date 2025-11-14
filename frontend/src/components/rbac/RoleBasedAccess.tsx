/**
 * Role-Based Access Components
 *
 * Components for conditional rendering based on user roles
 */

import React from 'react';
import { useAuthStore } from '@store/authStore';
import { hasPermission, hasMinimumRole, type UserRole, type RolePermissions } from '@utils/rbac';

interface RoleBasedAccessProps {
  children: React.ReactNode;
  /** Minimum required role */
  minimumRole?: UserRole;
  /** Specific permission required */
  permission?: keyof RolePermissions;
  /** Allowed roles (explicit list) */
  allowedRoles?: UserRole[];
  /** Fallback content to show when access is denied */
  fallback?: React.ReactNode;
}

/**
 * Conditionally render children based on user role/permissions
 */
export const RoleBasedAccess: React.FC<RoleBasedAccessProps> = ({
  children,
  minimumRole,
  permission,
  allowedRoles,
  fallback = null,
}) => {
  const { user } = useAuthStore();

  if (!user) {
    return <>{fallback}</>;
  }

  const userRole = (user.role || 'viewer') as UserRole;

  // Check explicit role list
  if (allowedRoles) {
    if (!allowedRoles.includes(userRole)) {
      return <>{fallback}</>;
    }
    return <>{children}</>;
  }

  // Check minimum role
  if (minimumRole) {
    if (!hasMinimumRole(userRole, minimumRole)) {
      return <>{fallback}</>;
    }
    return <>{children}</>;
  }

  // Check specific permission
  if (permission) {
    if (!hasPermission(userRole, permission)) {
      return <>{fallback}</>;
    }
    return <>{children}</>;
  }

  // No restrictions - show children
  return <>{children}</>;
};

/**
 * Show content only to viewers
 */
export const ViewerOnly: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({
  children,
  fallback,
}) => (
  <RoleBasedAccess allowedRoles={['viewer']} fallback={fallback}>
    {children}
  </RoleBasedAccess>
);

/**
 * Show content only to editors and above
 */
export const EditorOnly: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({
  children,
  fallback,
}) => (
  <RoleBasedAccess minimumRole="editor" fallback={fallback}>
    {children}
  </RoleBasedAccess>
);

/**
 * Show content only to admins
 */
export const AdminOnly: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({
  children,
  fallback,
}) => (
  <RoleBasedAccess allowedRoles={['admin']} fallback={fallback}>
    {children}
  </RoleBasedAccess>
);

/**
 * Show content to editors and admins (content managers)
 */
export const ContentManagerOnly: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({
  children,
  fallback,
}) => (
  <RoleBasedAccess minimumRole="editor" fallback={fallback}>
    {children}
  </RoleBasedAccess>
);

/**
 * Hook to get user's role and permissions
 */
export const useUserRole = () => {
  const { user } = useAuthStore();
  const userRole = (user?.role || 'viewer') as UserRole;

  return {
    role: userRole,
    isViewer: userRole === 'viewer',
    isEditor: userRole === 'editor' || userRole === 'admin',
    isAdmin: userRole === 'admin',
    hasPermission: (permission: keyof RolePermissions) => hasPermission(userRole, permission),
    hasMinimumRole: (requiredRole: UserRole) => hasMinimumRole(userRole, requiredRole),
  };
};
