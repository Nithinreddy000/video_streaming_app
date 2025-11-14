const express = require('express');
const router = express.Router();
const invitationController = require('./invitation.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { requireAdmin } = require('../../middleware/rbac.middleware');

// Admin routes - require authentication and admin role
router.use(authenticate, requireAdmin);

/**
 * @route   POST /api/v1/admin/invitations
 * @desc    Create and send invitation
 * @access  Admin only
 */
router.post('/', invitationController.createInvitation);

/**
 * @route   GET /api/v1/admin/invitations
 * @desc    Get all invitations
 * @access  Admin only
 * @query   tenantId, status, email, page, limit
 */
router.get('/', invitationController.getAllInvitations);

/**
 * @route   GET /api/v1/admin/invitations/:id
 * @desc    Get invitation by ID
 * @access  Admin only
 */
router.get('/:id', invitationController.getInvitationById);

/**
 * @route   POST /api/v1/admin/invitations/:id/resend
 * @desc    Resend invitation
 * @access  Admin only
 */
router.post('/:id/resend', invitationController.resendInvitation);

/**
 * @route   DELETE /api/v1/admin/invitations/:id
 * @desc    Cancel invitation
 * @access  Admin only
 */
router.delete('/:id', invitationController.cancelInvitation);

module.exports = router;
