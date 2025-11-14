const { Tenant } = require('../models');
const { HTTP_STATUS } = require('../utils/constants');
const logger = require('../utils/logger');

/**
 * Tenant middleware - Ensure all database queries are scoped to the user's tenant
 * This middleware should be used after authentication middleware
 */
const enforceTenantScope = (req, res, next) => {
  try {
    // Check if user is authenticated
    if (!req.user || !req.tenantId) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        error: 'Authentication required',
        message: 'Tenant context not found'
      });
    }

    // Attach tenant filter helper to request
    req.tenantFilter = (additionalFilters = {}) => {
      return {
        tenant: req.tenantId,
        ...additionalFilters
      };
    };

    next();
  } catch (error) {
    logger.error('Tenant scope enforcement error:', error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: 'Tenant scope error',
      message: 'An error occurred while enforcing tenant scope'
    });
  }
};

/**
 * Verify tenant exists and is active
 */
const verifyTenantActive = async (req, res, next) => {
  try {
    if (!req.tenantId) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Tenant required',
        message: 'Tenant ID not found in request'
      });
    }

    const tenant = await Tenant.findById(req.tenantId);

    if (!tenant) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Tenant not found',
        message: 'The specified tenant does not exist'
      });
    }

    if (!tenant.isActive) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        error: 'Tenant inactive',
        message: 'Your organization account is not active'
      });
    }

    // Check subscription status
    if (tenant.subscription.status !== 'active' && tenant.subscription.status !== 'trial') {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        error: 'Subscription inactive',
        message: `Subscription status: ${tenant.subscription.status}. Please contact support.`
      });
    }

    // Attach tenant to request
    req.tenant = tenant;

    next();
  } catch (error) {
    logger.error('Tenant verification error:', error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: 'Tenant verification error',
      message: 'An error occurred while verifying tenant status'
    });
  }
};

/**
 * Check if tenant has reached storage limit
 */
const checkStorageLimit = async (req, res, next) => {
  try {
    if (!req.tenant) {
      // Load tenant if not already loaded
      req.tenant = await Tenant.findById(req.tenantId);
    }

    if (!req.tenant) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Tenant not found',
        message: 'Tenant not found'
      });
    }

    if (req.tenant.hasReachedStorageLimit()) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        error: 'Storage limit reached',
        message: `Your organization has reached its storage limit of ${req.tenant.settings.maxStorageGB}GB`,
        currentUsage: req.tenant.usage.totalStorageUsedGB,
        limit: req.tenant.settings.maxStorageGB
      });
    }

    next();
  } catch (error) {
    logger.error('Storage limit check error:', error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: 'Storage check error',
      message: 'An error occurred while checking storage limits'
    });
  }
};

/**
 * Check if tenant can upload a video of specified size
 */
const checkVideoUploadAllowed = async (req, res, next) => {
  try {
    if (!req.tenant) {
      req.tenant = await Tenant.findById(req.tenantId);
    }

    if (!req.tenant) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Tenant not found',
        message: 'Tenant not found'
      });
    }

    // Get video size from file if available
    let videoSizeMB = 0;
    if (req.file) {
      videoSizeMB = req.file.size / (1024 * 1024); // Convert bytes to MB
    } else if (req.body.fileSize) {
      videoSizeMB = req.body.fileSize / (1024 * 1024);
    }

    const canUpload = req.tenant.canUploadVideo(videoSizeMB);

    if (!canUpload.allowed) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        error: 'Upload not allowed',
        message: canUpload.reason,
        videoSize: videoSizeMB,
        maxSize: req.tenant.settings.maxVideoSizeMB,
        currentStorage: req.tenant.usage.totalStorageUsedGB,
        maxStorage: req.tenant.settings.maxStorageGB
      });
    }

    next();
  } catch (error) {
    logger.error('Video upload check error:', error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: 'Upload check error',
      message: 'An error occurred while checking upload permissions'
    });
  }
};

/**
 * Attach tenant settings to request
 */
const attachTenantSettings = async (req, res, next) => {
  try {
    if (!req.tenant && req.tenantId) {
      req.tenant = await Tenant.findById(req.tenantId);
    }

    if (req.tenant) {
      req.tenantSettings = req.tenant.settings;
    }

    next();
  } catch (error) {
    logger.error('Attach tenant settings error:', error);
    next(); // Continue even if this fails
  }
};

module.exports = {
  enforceTenantScope,
  verifyTenantActive,
  checkStorageLimit,
  checkVideoUploadAllowed,
  attachTenantSettings
};
