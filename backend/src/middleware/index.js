const { authenticate, optionalAuthenticate } = require('./auth.middleware');
const {
  authorize,
  requireAdmin,
  requireEditor,
  requireViewer,
  requireOwnerOrAdmin,
  canModerate,
  checkPermission
} = require('./rbac.middleware');
const {
  enforceTenantScope,
  verifyTenantActive,
  checkStorageLimit,
  checkVideoUploadAllowed,
  attachTenantSettings
} = require('./tenant.middleware');

module.exports = {
  // Authentication
  authenticate,
  optionalAuthenticate,

  // Authorization (RBAC)
  authorize,
  requireAdmin,
  requireEditor,
  requireViewer,
  requireOwnerOrAdmin,
  canModerate,
  checkPermission,

  // Multi-tenant
  enforceTenantScope,
  verifyTenantActive,
  checkStorageLimit,
  checkVideoUploadAllowed,
  attachTenantSettings
};
