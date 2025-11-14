const express = require('express');
const router = express.Router();
const invitationController = require('../admin/invitation.controller');

/**
 * Public invitation routes (no authentication required)
 */

/**
 * @route   GET /api/v1/invitations/verify/:token
 * @desc    Verify invitation token
 * @access  Public
 */
router.get('/verify/:token', invitationController.verifyInvitation);

/**
 * @route   POST /api/v1/invitations/accept/:token
 * @desc    Accept invitation and register user
 * @access  Public
 */
router.post('/accept/:token', invitationController.acceptInvitation);

module.exports = router;
