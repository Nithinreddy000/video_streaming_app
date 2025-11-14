/**
 * Role-Based Access Control (RBAC) Utilities
 *
 * Helper functions for role-based UI rendering and permission checking
 */

export type UserRole = 'viewer' | 'editor' | 'admin';

export interface RolePermissions {
  canUpload: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canModerate: boolean;
  canManageUsers: boolean;
  canViewAnalytics: boolean;
  canViewAllContent: boolean;
}

/**
 * Role hierarchy for permission checking
 */
const ROLE_HIERARCHY: Record<UserRole, number> = {
  viewer: 1,
  editor: 2,
  admin: 3,
};

/**
 * Get permissions for a given role
 */
export const getRolePermissions = (role: UserRole): RolePermissions => {
  const roleLevel = ROLE_HIERARCHY[role] || 0;

  return {
    // Viewer permissions (level 1)
    canUpload: roleLevel >= 2, // editor+
    canEdit: roleLevel >= 2, // editor+
    canDelete: roleLevel >= 2, // editor+
    canModerate: roleLevel >= 2, // editor+
    canManageUsers: roleLevel >= 3, // admin only
    canViewAnalytics: roleLevel >= 2, // editor+
    canViewAllContent: roleLevel >= 3, // admin only (viewers/editors see only their own)
  };
};

/**
 * Check if user has specific permission
 */
export const hasPermission = (role: UserRole, permission: keyof RolePermissions): boolean => {
  const permissions = getRolePermissions(role);
  return permissions[permission];
};

/**
 * Check if user has minimum required role
 */
export const hasMinimumRole = (userRole: UserRole, requiredRole: UserRole): boolean => {
  const userLevel = ROLE_HIERARCHY[userRole] || 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole] || 0;
  return userLevel >= requiredLevel;
};

/**
 * Get role display name
 */
export const getRoleDisplayName = (role: UserRole): string => {
  const names: Record<UserRole, string> = {
    viewer: 'Viewer',
    editor: 'Editor',
    admin: 'Administrator',
  };
  return names[role] || role;
};

/**
 * Get role description
 */
export const getRoleDescription = (role: UserRole): string => {
  const descriptions: Record<UserRole, string> = {
    viewer: 'Read-only access to assigned videos',
    editor: 'Upload, edit, and manage video content',
    admin: 'Full system access including user management',
  };
  return descriptions[role] || '';
};

/**
 * Get role badge color
 */
export const getRoleBadgeColor = (role: UserRole): string => {
  const colors: Record<UserRole, string> = {
    viewer: 'bg-blue-500',
    editor: 'bg-green-500',
    admin: 'bg-purple-500',
  };
  return colors[role] || 'bg-gray-500';
};

/**
 * Dashboard feature visibility by role
 */
export interface DashboardFeatures {
  showUploadButton: boolean;
  showModeration: boolean;
  showUserManagement: boolean;
  showFullAnalytics: boolean;
  showEditControls: boolean;
  showDeleteControls: boolean;
  showTenantSettings: boolean;
}

/**
 * Get dashboard features for role
 */
export const getDashboardFeatures = (role: UserRole): DashboardFeatures => {
  const permissions = getRolePermissions(role);

  return {
    showUploadButton: permissions.canUpload,
    showModeration: permissions.canModerate,
    showUserManagement: permissions.canManageUsers,
    showFullAnalytics: permissions.canViewAnalytics,
    showEditControls: permissions.canEdit,
    showDeleteControls: permissions.canDelete,
    showTenantSettings: permissions.canManageUsers,
  };
};

/**
 * Filter stats based on role permissions
 */
export const filterStatsForRole = (
  role: UserRole,
  stats: Array<{ key: string; requiresAdmin?: boolean; requiresEditor?: boolean }>
): typeof stats => {
  const roleLevel = ROLE_HIERARCHY[role] || 0;

  return stats.filter(stat => {
    if (stat.requiresAdmin && roleLevel < 3) return false;
    if (stat.requiresEditor && roleLevel < 2) return false;
    return true;
  });
};
