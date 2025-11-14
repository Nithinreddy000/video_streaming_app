/**
 * Role-Based Access Control (RBAC) Middleware
 *
 * Implements fine-grained access control based on user roles:
 * - viewer: Read-only access to assigned videos
 * - editor: Upload, edit, and manage own video content
 * - admin: Full system access including user management
 */

const { HTTP_STATUS } = require('../utils/constants');
const logger = require('../utils/logger');

/**
 * Check if user has required role(s)
 * @param {string|string[]} roles - Required role(s)
 * @returns {Function} Express middleware
 */
const requireRole = (roles) => {
  // Normalize to array
  const requiredRoles = Array.isArray(roles) ? roles : [roles];

  return (req, res, next) => {
    // Check if user is authenticated
    if (!req.user) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        error: 'Authentication required',
        message: 'You must be logged in to access this resource'
      });
    }

    // Check if user has required role
    if (!requiredRoles.includes(req.user.role)) {
      logger.warn(`Access denied for user ${req.userId} with role ${req.user.role}. Required: ${requiredRoles.join(' or ')}`);
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        error: 'Insufficient permissions',
        message: `This action requires ${requiredRoles.join(' or ')} role`,
        requiredRole: requiredRoles,
        currentRole: req.user.role
      });
    }

    next();
  };
};

/**
 * Check if user can modify a resource (must be owner or admin)
 * @param {Function} getResourceOwnerId - Function to get resource owner ID
 * @returns {Function} Express middleware
 */
const requireOwnershipOrAdmin = (getResourceOwnerId) => {
  return async (req, res, next) => {
    try {
      // Admins can access everything
      if (req.user.role === 'admin') {
        return next();
      }

      // Get resource owner ID
      const ownerId = await getResourceOwnerId(req);

      // Check ownership
      if (!ownerId || ownerId.toString() !== req.userId.toString()) {
        logger.warn(`Access denied: User ${req.userId} attempted to access resource owned by ${ownerId}`);
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          error: 'Access denied',
          message: 'You can only modify your own content'
        });
      }

      next();
    } catch (error) {
      logger.error('Ownership check error:', error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: 'Authorization check failed',
        message: 'An error occurred while verifying permissions'
      });
    }
  };
};

/**
 * Role hierarchy checker - higher roles can perform lower role actions
 * @param {string} minRole - Minimum required role
 * @returns {Function} Express middleware
 */
const requireMinRole = (minRole) => {
  const roleHierarchy = {
    viewer: 1,
    editor: 2,
    admin: 3
  };

  return (req, res, next) => {
    if (!req.user) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        error: 'Authentication required',
        message: 'You must be logged in to access this resource'
      });
    }

    const userRoleLevel = roleHierarchy[req.user.role] || 0;
    const minRoleLevel = roleHierarchy[minRole] || 0;

    if (userRoleLevel < minRoleLevel) {
      logger.warn(`Access denied: User ${req.userId} (${req.user.role}) needs minimum role: ${minRole}`);
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        error: 'Insufficient permissions',
        message: `This action requires at least ${minRole} role`,
        requiredRole: minRole,
        currentRole: req.user.role
      });
    }

    next();
  };
};

/**
 * Permissions configuration for different operations
 */
const PERMISSIONS = {
  // Video operations
  VIDEO_VIEW: ['viewer', 'editor', 'admin'],
  VIDEO_UPLOAD: ['editor', 'admin'],
  VIDEO_EDIT: ['editor', 'admin'], // Must also be owner or admin
  VIDEO_DELETE: ['editor', 'admin'], // Must also be owner or admin
  VIDEO_REVIEW: ['admin'], // AI moderation review

  // User operations
  USER_VIEW_ALL: ['admin'],
  USER_CREATE: ['admin'],
  USER_EDIT: ['admin'],
  USER_DELETE: ['admin'],

  // Analytics
  ANALYTICS_VIEW_OWN: ['editor', 'admin'],
  ANALYTICS_VIEW_ALL: ['admin'],

  // Tenant operations
  TENANT_MANAGE: ['admin']
};

/**
 * Check specific permission
 * @param {string} permission - Permission name from PERMISSIONS
 * @returns {Function} Express middleware
 */
const checkPermission = (permission) => {
  const roles = PERMISSIONS[permission];
  if (!roles) {
    throw new Error(`Unknown permission: ${permission}`);
  }
  return requireRole(roles);
};

module.exports = {
  requireRole,
  requireOwnershipOrAdmin,
  requireMinRole,
  checkPermission,
  PERMISSIONS
};
