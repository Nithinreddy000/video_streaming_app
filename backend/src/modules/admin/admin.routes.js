const express = require('express');
const router = express.Router();
const adminController = require('./admin.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { requireAdmin } = require('../../middleware/rbac.middleware');

// All admin routes require admin role
router.use(authenticate, requireAdmin);

/**
 * @route   GET /api/v1/admin/users
 * @desc    Get all users across all tenants
 * @access  Admin only
 * @query   tenantId, role, isActive, search, page, limit, sortBy, sortOrder
 */
router.get('/users', adminController.getAllUsers);

/**
 * @route   POST /api/v1/admin/users
 * @desc    Create new user
 * @access  Admin only
 */
router.post('/users', adminController.createUser);

/**
 * @route   GET /api/v1/admin/users/:id
 * @desc    Get single user by ID
 * @access  Admin only
 */
router.get('/users/:id', adminController.getUserById);

/**
 * @route   PUT /api/v1/admin/users/:id
 * @desc    Update user
 * @access  Admin only
 */
router.put('/users/:id', adminController.updateUser);

/**
 * @route   DELETE /api/v1/admin/users/:id
 * @desc    Deactivate user (soft delete)
 * @access  Admin only
 */
router.delete('/users/:id', adminController.deactivateUser);

/**
 * @route   PUT /api/v1/admin/users/:id/role
 * @desc    Change user role
 * @access  Admin only
 */
router.put('/users/:id/role', adminController.changeUserRole);

/**
 * @route   PUT /api/v1/admin/users/:id/tenant
 * @desc    Move user to different organization
 * @access  Admin only
 */
router.put('/users/:id/tenant', adminController.changeUserTenant);

/**
 * @route   GET /api/v1/admin/stats
 * @desc    Get system statistics
 * @access  Admin only
 */
router.get('/stats', adminController.getSystemStats);

module.exports = router;
