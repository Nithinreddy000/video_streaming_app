const { Invitation, User, Tenant } = require('../../models');
const { HTTP_STATUS } = require('../../utils/constants');
const logger = require('../../utils/logger');

/**
 * Create and send invitation
 * POST /api/v1/admin/invitations
 * @access Admin only
 */
const createInvitation = async (req, res) => {
  try {
    const { email, tenantId, role } = req.body;

    // Validation
    if (!email || !tenantId) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Validation error',
        message: 'Email and tenantId are required'
      });
    }

    // Check if user already exists with this email
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(HTTP_STATUS.CONFLICT).json({
        error: 'User already exists',
        message: 'A user with this email already exists'
      });
    }

    // Verify tenant exists
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Tenant not found',
        message: 'The specified organization does not exist'
      });
    }

    // Check if there's already a pending invitation for this email and tenant
    const existingInvitation = await Invitation.findOne({
      email: email.toLowerCase(),
      tenant: tenantId,
      status: 'pending',
      expiresAt: { $gt: new Date() }
    });

    if (existingInvitation) {
      return res.status(HTTP_STATUS.CONFLICT).json({
        error: 'Invitation already exists',
        message: 'An active invitation already exists for this email',
        invitation: {
          id: existingInvitation._id,
          email: existingInvitation.email,
          expiresAt: existingInvitation.expiresAt
        }
      });
    }

    // Create invitation
    const invitation = await Invitation.create({
      email: email.toLowerCase(),
      tenant: tenantId,
      role: role || 'viewer',
      invitedBy: req.user._id
    });

    // Populate relations
    await invitation.populate([
      { path: 'tenant', select: 'name slug' },
      { path: 'invitedBy', select: 'username email' }
    ]);

    // TODO: Send invitation email
    // await emailService.sendInvitation(invitation);

    logger.info(`Invitation created: ${email} to ${tenant.name} as ${invitation.role} by ${req.user.email}`);

    // Generate invitation URL
    const invitationUrl = `${process.env.FRONTEND_URL}/accept-invitation?token=${invitation.token}`;

    res.status(HTTP_STATUS.CREATED).json({
      message: 'Invitation created successfully',
      invitation: {
        id: invitation._id,
        email: invitation.email,
        role: invitation.role,
        tenant: invitation.tenant,
        invitedBy: invitation.invitedBy,
        expiresAt: invitation.expiresAt,
        invitationUrl
      }
    });
  } catch (error) {
    logger.error('Create invitation error:', error);

    if (error.name === 'ValidationError') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Validation error',
        message: Object.values(error.errors).map(e => e.message).join(', ')
      });
    }

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: 'Failed to create invitation',
      message: error.message
    });
  }
};

/**
 * Get all invitations
 * GET /api/v1/admin/invitations
 * @access Admin only
 */
const getAllInvitations = async (req, res) => {
  try {
    // Build query
    const query = {};

    // Filter by tenant if provided
    if (req.query.tenantId) {
      query.tenant = req.query.tenantId;
    }

    // Filter by status if provided
    if (req.query.status) {
      query.status = req.query.status;
    }

    // Filter by email if provided
    if (req.query.email) {
      query.email = { $regex: req.query.email, $options: 'i' };
    }

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Get invitations
    const invitations = await Invitation.find(query)
      .populate('tenant', 'name slug')
      .populate('invitedBy', 'username email')
      .populate('acceptedBy', 'username email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Get total count
    const total = await Invitation.countDocuments(query);

    res.status(HTTP_STATUS.OK).json({
      invitations,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit
      }
    });
  } catch (error) {
    logger.error('Get all invitations error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: 'Failed to fetch invitations',
      message: error.message
    });
  }
};

/**
 * Get invitation by ID
 * GET /api/v1/admin/invitations/:id
 * @access Admin only
 */
const getInvitationById = async (req, res) => {
  try {
    const invitation = await Invitation.findById(req.params.id)
      .populate('tenant', 'name slug')
      .populate('invitedBy', 'username email fullName')
      .populate('acceptedBy', 'username email fullName');

    if (!invitation) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Invitation not found',
        message: 'The specified invitation does not exist'
      });
    }

    res.status(HTTP_STATUS.OK).json({ invitation });
  } catch (error) {
    logger.error('Get invitation by ID error:', error);

    if (error.name === 'CastError') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Invalid invitation ID',
        message: 'The provided invitation ID is not valid'
      });
    }

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: 'Failed to fetch invitation',
      message: error.message
    });
  }
};

/**
 * Resend invitation
 * POST /api/v1/admin/invitations/:id/resend
 * @access Admin only
 */
const resendInvitation = async (req, res) => {
  try {
    const invitation = await Invitation.findById(req.params.id)
      .populate('tenant', 'name slug');

    if (!invitation) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Invitation not found',
        message: 'The specified invitation does not exist'
      });
    }

    // Check if invitation is still valid (pending and not expired)
    if (invitation.status !== 'pending') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Cannot resend invitation',
        message: `Invitation status is ${invitation.status}`
      });
    }

    // Extend expiration if needed
    if (invitation.expiresAt < new Date()) {
      invitation.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      invitation.status = 'pending';
      await invitation.save();
    }

    // TODO: Resend invitation email
    // await emailService.sendInvitation(invitation);

    logger.info(`Invitation resent: ${invitation.email} by ${req.user.email}`);

    const invitationUrl = `${process.env.FRONTEND_URL}/accept-invitation?token=${invitation.token}`;

    res.status(HTTP_STATUS.OK).json({
      message: 'Invitation resent successfully',
      invitation: {
        id: invitation._id,
        email: invitation.email,
        expiresAt: invitation.expiresAt,
        invitationUrl
      }
    });
  } catch (error) {
    logger.error('Resend invitation error:', error);

    if (error.name === 'CastError') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Invalid invitation ID',
        message: 'The provided invitation ID is not valid'
      });
    }

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: 'Failed to resend invitation',
      message: error.message
    });
  }
};

/**
 * Cancel invitation
 * DELETE /api/v1/admin/invitations/:id
 * @access Admin only
 */
const cancelInvitation = async (req, res) => {
  try {
    const invitation = await Invitation.findById(req.params.id);

    if (!invitation) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Invitation not found',
        message: 'The specified invitation does not exist'
      });
    }

    if (invitation.status !== 'pending') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Cannot cancel invitation',
        message: `Invitation status is ${invitation.status}`
      });
    }

    await invitation.cancel();

    logger.info(`Invitation cancelled: ${invitation.email} by ${req.user.email}`);

    res.status(HTTP_STATUS.OK).json({
      message: 'Invitation cancelled successfully',
      invitation: {
        id: invitation._id,
        email: invitation.email,
        status: invitation.status
      }
    });
  } catch (error) {
    logger.error('Cancel invitation error:', error);

    if (error.name === 'CastError') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Invalid invitation ID',
        message: 'The provided invitation ID is not valid'
      });
    }

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: 'Failed to cancel invitation',
      message: error.message
    });
  }
};

/**
 * Verify invitation token (public endpoint)
 * GET /api/v1/invitations/verify/:token
 * @access Public
 */
const verifyInvitation = async (req, res) => {
  try {
    const invitation = await Invitation.findOne({ token: req.params.token })
      .populate('tenant', 'name slug settings');

    if (!invitation) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Invalid invitation',
        message: 'This invitation link is invalid or has been removed'
      });
    }

    // Check if valid
    if (!invitation.isValid()) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Invitation expired or invalid',
        message: invitation.status === 'expired'
          ? 'This invitation has expired'
          : `This invitation is ${invitation.status}`,
        status: invitation.status
      });
    }

    res.status(HTTP_STATUS.OK).json({
      message: 'Invitation is valid',
      invitation: {
        email: invitation.email,
        role: invitation.role,
        tenant: invitation.tenant,
        expiresAt: invitation.expiresAt
      }
    });
  } catch (error) {
    logger.error('Verify invitation error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: 'Failed to verify invitation',
      message: error.message
    });
  }
};

/**
 * Accept invitation and register user (public endpoint)
 * POST /api/v1/invitations/accept/:token
 * @access Public
 */
const acceptInvitation = async (req, res) => {
  try {
    const { username, password, firstName, lastName } = req.body;

    // Validation
    if (!username || !password) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Validation error',
        message: 'Username and password are required'
      });
    }

    // Find invitation
    const invitation = await Invitation.findOne({ token: req.params.token })
      .populate('tenant', 'name slug');

    if (!invitation) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Invalid invitation',
        message: 'This invitation link is invalid'
      });
    }

    // Check if valid
    if (!invitation.isValid()) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Invitation expired or invalid',
        message: invitation.status === 'expired'
          ? 'This invitation has expired'
          : `This invitation is ${invitation.status}`,
        status: invitation.status
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email: invitation.email }, { username }]
    });

    if (existingUser) {
      return res.status(HTTP_STATUS.CONFLICT).json({
        error: 'User already exists',
        message: existingUser.email === invitation.email
          ? 'This email is already registered. Please login instead.'
          : 'Username already taken'
      });
    }

    // Create user
    const user = await User.create({
      username,
      email: invitation.email,
      password, // Will be hashed by pre-save hook
      firstName,
      lastName,
      role: invitation.role,
      tenant: invitation.tenant._id,
      isActive: true
    });

    // Update tenant user count
    await Tenant.findByIdAndUpdate(invitation.tenant._id, { $inc: { 'usage.totalUsers': 1 } });

    // Mark invitation as accepted
    await invitation.accept(user._id);

    logger.info(`Invitation accepted: ${user.email} (${user.username}) joined ${invitation.tenant.name}`);

    // Generate tokens
    const { generateTokenPair } = require('../../utils/jwt.utils');
    const tokens = generateTokenPair(user);

    // Add refresh token to user
    await user.addRefreshToken(tokens.refreshToken);

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Populate tenant info
    await user.populate('tenant', 'name slug isActive subscription');

    // Return response (same as register/login)
    res.status(HTTP_STATUS.CREATED).json({
      message: 'Registration successful',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        tenant: user.tenant
      },
      tokens
    });
  } catch (error) {
    logger.error('Accept invitation error:', error);

    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(HTTP_STATUS.CONFLICT).json({
        error: 'Duplicate error',
        message: `${field} already exists`
      });
    }

    if (error.name === 'ValidationError') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Validation error',
        message: Object.values(error.errors).map(e => e.message).join(', ')
      });
    }

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: 'Failed to accept invitation',
      message: error.message
    });
  }
};

module.exports = {
  createInvitation,
  getAllInvitations,
  getInvitationById,
  resendInvitation,
  cancelInvitation,
  verifyInvitation,
  acceptInvitation
};
