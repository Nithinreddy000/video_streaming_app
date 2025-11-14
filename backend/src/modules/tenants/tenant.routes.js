const express = require('express');
const router = express.Router();
const tenantController = require('./tenant.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { requireAdmin } = require('../../middleware/rbac.middleware');

// All tenant routes require admin role
router.use(authenticate, requireAdmin);

/**
 * @route   GET /api/v1/tenants
 * @desc    Get all organizations/tenants
 * @access  Admin only
 * @query   isActive, subscriptionStatus, page, limit, sortBy, sortOrder
 */
router.get('/', tenantController.getAllTenants);

/**
 * @route   POST /api/v1/tenants
 * @desc    Create new organization/tenant
 * @access  Admin only
 */
router.post('/', tenantController.createTenant);

/**
 * @route   GET /api/v1/tenants/:id
 * @desc    Get single tenant by ID
 * @access  Admin only
 */
router.get('/:id', tenantController.getTenantById);

/**
 * @route   PUT /api/v1/tenants/:id
 * @desc    Update tenant
 * @access  Admin only
 */
router.put('/:id', tenantController.updateTenant);

/**
 * @route   DELETE /api/v1/tenants/:id
 * @desc    Deactivate tenant (soft delete)
 * @access  Admin only
 * @query   force=true to deactivate all users
 */
router.delete('/:id', tenantController.deactivateTenant);

/**
 * @route   GET /api/v1/tenants/:id/users
 * @desc    Get users in a tenant
 * @access  Admin only
 * @query   role, isActive, page, limit
 */
router.get('/:id/users', tenantController.getTenantUsers);

/**
 * @route   GET /api/v1/tenants/:id/stats
 * @desc    Get tenant statistics
 * @access  Admin only
 */
router.get('/:id/stats', tenantController.getTenantStats);

module.exports = router;
