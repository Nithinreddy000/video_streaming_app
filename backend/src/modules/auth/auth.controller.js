const { User, Tenant } = require('../../models');
const { generateTokenPair } = require('../../utils/jwt.utils');
const { verifyRefreshToken } = require('../../utils/jwt.utils');
const { HTTP_STATUS } = require('../../utils/constants');
const logger = require('../../utils/logger');

/**
 * Register a new user
 * POST /api/v1/auth/register
 */
const register = async (req, res) => {
  try {
    const { username, email, password, firstName, lastName, tenantName, role } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Validation error',
        message: 'Username, email, and password are required'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return res.status(HTTP_STATUS.CONFLICT).json({
        error: 'User already exists',
        message: existingUser.email === email
          ? 'Email already registered'
          : 'Username already taken'
      });
    }

    // Handle tenant - either find existing or create new
    let tenant;
    if (req.body.tenantId) {
      // Join existing tenant
      tenant = await Tenant.findById(req.body.tenantId);
      if (!tenant) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          error: 'Tenant not found',
          message: 'The specified tenant does not exist'
        });
      }
    } else {
      // Create new tenant for first user
      const tenantSlug = (tenantName || username)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

      tenant = await Tenant.create({
        name: tenantName || `${username}'s Organization`,
        slug: tenantSlug,
        subscription: {
          plan: 'free',
          status: 'trial'
        },
        createdBy: null // Will be updated after user creation
      });

      logger.info(`New tenant created: ${tenant.name} (${tenant.slug})`);
    }

    // Create user
    const user = await User.create({
      username,
      email,
      password, // Will be hashed by pre-save hook
      firstName,
      lastName,
      role: role || 'viewer', // Default role
      tenant: tenant._id
    });

    // Update tenant's createdBy if this is the first user
    if (!tenant.createdBy) {
      tenant.createdBy = user._id;
      tenant.usage.totalUsers = 1;
      await tenant.save();
    } else {
      await tenant.updateOne({ $inc: { 'usage.totalUsers': 1 } });
    }

    // Generate tokens
    const tokens = generateTokenPair(user);

    // Add refresh token to user
    await user.addRefreshToken(tokens.refreshToken);

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    logger.info(`New user registered: ${user.email} (${user.username}) in tenant ${tenant.name}`);

    // Return response
    res.status(HTTP_STATUS.CREATED).json({
      message: 'User registered successfully',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        tenant: {
          id: tenant._id,
          name: tenant.name,
          slug: tenant.slug
        }
      },
      tokens
    });
  } catch (error) {
    logger.error('Registration error:', error);

    if (error.code === 11000) {
      // Duplicate key error
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
      error: 'Registration failed',
      message: 'An error occurred during registration'
    });
  }
};

/**
 * Login user
 * POST /api/v1/auth/login
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Validation error',
        message: 'Email and password are required'
      });
    }

    // Find user by email (include password for comparison)
    const user = await User.findOne({ email })
      .select('+password')
      .populate('tenant', 'name slug isActive subscription');

    if (!user) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        error: 'Authentication failed',
        message: 'Invalid email or password'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        error: 'Account inactive',
        message: 'Your account has been deactivated'
      });
    }

    // Check if tenant is active
    if (!user.tenant || !user.tenant.isActive) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        error: 'Tenant inactive',
        message: 'Your organization account is not active'
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      logger.warn(`Failed login attempt for user: ${email}`);
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        error: 'Authentication failed',
        message: 'Invalid email or password'
      });
    }

    // Generate tokens
    const tokens = generateTokenPair(user);

    // Add refresh token to user
    await user.addRefreshToken(tokens.refreshToken);

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    logger.info(`User logged in: ${user.email}`);

    // Return response
    res.status(HTTP_STATUS.OK).json({
      message: 'Login successful',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        tenant: {
          id: user.tenant._id,
          name: user.tenant.name,
          slug: user.tenant.slug,
          subscription: user.tenant.subscription
        }
      },
      tokens
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: 'Login failed',
      message: 'An error occurred during login'
    });
  }
};

/**
 * Refresh access token
 * POST /api/v1/auth/refresh
 */
const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Validation error',
        message: 'Refresh token is required'
      });
    }

    // Verify refresh token
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (error) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        error: 'Invalid token',
        message: error.message
      });
    }

    // Find user and check if refresh token is valid
    const user = await User.findById(decoded.id)
      .populate('tenant', 'name slug isActive');

    if (!user) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        error: 'Authentication failed',
        message: 'User not found'
      });
    }

    // Check if refresh token exists in user's token list
    const tokenExists = user.refreshTokens.some(rt => rt.token === refreshToken);

    if (!tokenExists) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        error: 'Invalid token',
        message: 'Refresh token not found or expired'
      });
    }

    // Generate new token pair
    const tokens = generateTokenPair(user);

    // Replace old refresh token with new one (atomic operation to avoid versioning conflicts)
    await user.replaceRefreshToken(refreshToken, tokens.refreshToken);

    logger.info(`Token refreshed for user: ${user.email}`);

    res.status(HTTP_STATUS.OK).json({
      message: 'Token refreshed successfully',
      tokens
    });
  } catch (error) {
    logger.error('Token refresh error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: 'Token refresh failed',
      message: 'An error occurred during token refresh'
    });
  }
};

/**
 * Logout user
 * POST /api/v1/auth/logout
 */
const logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(HTTP_STATUS.OK).json({
        message: 'Logout successful'
      });
    }

    // Remove refresh token from user's token list
    if (req.user) {
      await req.user.removeRefreshToken(refreshToken);
      logger.info(`User logged out: ${req.user.email}`);
    }

    res.status(HTTP_STATUS.OK).json({
      message: 'Logout successful'
    });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: 'Logout failed',
      message: 'An error occurred during logout'
    });
  }
};

/**
 * Get current user profile
 * GET /api/v1/auth/me
 */
const getCurrentUser = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        error: 'Authentication required',
        message: 'No user logged in'
      });
    }

    // Populate tenant information
    await req.user.populate('tenant', 'name slug isActive subscription settings usage');

    res.status(HTTP_STATUS.OK).json({
      user: {
        id: req.user._id,
        username: req.user.username,
        email: req.user.email,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        role: req.user.role,
        isActive: req.user.isActive,
        lastLogin: req.user.lastLogin,
        tenant: req.user.tenant,
        createdAt: req.user.createdAt
      }
    });
  } catch (error) {
    logger.error('Get current user error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: 'Failed to get user',
      message: 'An error occurred while fetching user data'
    });
  }
};

module.exports = {
  register,
  login,
  refreshToken,
  logout,
  getCurrentUser
};
