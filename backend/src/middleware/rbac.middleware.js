const { HTTP_STATUS } = require('../utils/constants');
const logger = require('../utils/logger');

/**
 * Role hierarchy - Higher roles include permissions of lower roles
 */
const ROLE_HIERARCHY = {
  viewer: 1,
  editor: 2,
  admin: 3
};

/**
 * Check if user has required role
 * @param {string} userRole - User's role
 * @param {string} requiredRole - Required role
 * @returns {boolean}
 */
const hasRole = (userRole, requiredRole) => {
  const userLevel = ROLE_HIERARCHY[userRole] || 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole] || 0;
  return userLevel >= requiredLevel;
};

/**
 * Authorization middleware - Check if user has required role
 * @param  {...string} allowedRoles - Allowed roles
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    try {
      // Check if user is authenticated
      if (!req.user) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          error: 'Authentication required',
          message: 'You must be logged in to access this resource'
        });
      }

      // Check if user has any of the allowed roles
      const hasPermission = allowedRoles.some(role => hasRole(req.user.role, role));

      if (!hasPermission) {
        logger.warn(`Access denied for user ${req.user.id} with role ${req.user.role} to endpoint ${req.path}`);
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          error: 'Access denied',
          message: `This action requires one of the following roles: ${allowedRoles.join(', ')}`,
          requiredRoles: allowedRoles,
          userRole: req.user.role
        });
      }

      next();
    } catch (error) {
      logger.error('Authorization middleware error:', error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: 'Authorization error',
        message: 'An error occurred during authorization'
      });
    }
  };
};

/**
 * Check if user is admin
 */
const requireAdmin = authorize('admin');

/**
 * Check if user is editor or admin
 */
const requireEditor = authorize('editor', 'admin');

/**
 * Check if user is at least a viewer (any authenticated user)
 */
const requireViewer = authorize('viewer', 'editor', 'admin');

/**
 * Check if user owns the resource or is admin
 */
const requireOwnerOrAdmin = (resourceUserIdField = 'uploadedBy') => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          error: 'Authentication required',
          message: 'You must be logged in to access this resource'
        });
      }

      // Admins can access any resource
      if (req.user.role === 'admin') {
        return next();
      }

      // Check if user owns the resource
      const resource = req.resource; // Resource should be attached by controller
      if (!resource) {
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
          error: 'Server error',
          message: 'Resource not found in request context'
        });
      }

      const resourceUserId = resource[resourceUserIdField];
      if (!resourceUserId) {
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
          error: 'Server error',
          message: 'Resource user ID not found'
        });
      }

      // Convert to string for comparison
      const resourceUserIdStr = resourceUserId.toString();
      const currentUserIdStr = req.user._id.toString();

      if (resourceUserIdStr !== currentUserIdStr) {
        logger.warn(`Access denied: User ${req.user.id} attempted to access resource owned by ${resourceUserId}`);
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          error: 'Access denied',
          message: 'You do not have permission to access this resource'
        });
      }

      next();
    } catch (error) {
      logger.error('Owner/Admin authorization error:', error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: 'Authorization error',
        message: 'An error occurred during authorization'
      });
    }
  };
};

/**
 * Middleware to check if user can moderate content (editor or admin)
 */
const canModerate = authorize('editor', 'admin');

/**
 * Check specific permissions
 */
const checkPermission = (permission) => {
  const permissions = {
    // Video permissions
    'video:create': ['editor', 'admin'],
    'video:read': ['viewer', 'editor', 'admin'],
    'video:update': ['editor', 'admin'],
    'video:delete': ['editor', 'admin'],
    'video:moderate': ['editor', 'admin'],

    // User permissions
    'user:create': ['admin'],
    'user:read': ['admin'],
    'user:update': ['admin'],
    'user:delete': ['admin'],

    // Tenant permissions
    'tenant:create': ['admin'],
    'tenant:read': ['admin'],
    'tenant:update': ['admin'],
    'tenant:delete': ['admin'],

    // Analytics permissions
    'analytics:read': ['editor', 'admin']
  };

  const allowedRoles = permissions[permission];

  if (!allowedRoles) {
    logger.warn(`Unknown permission requested: ${permission}`);
    return (req, res, next) => {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        error: 'Permission denied',
        message: 'Unknown permission'
      });
    };
  }

  return authorize(...allowedRoles);
};

module.exports = {
  authorize,
  requireAdmin,
  requireEditor,
  requireViewer,
  requireOwnerOrAdmin,
  canModerate,
  checkPermission,
  hasRole,
  ROLE_HIERARCHY
};
