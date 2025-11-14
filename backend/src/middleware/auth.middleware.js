const { verifyAccessToken, extractTokenFromHeader } = require('../utils/jwt.utils');
const { User } = require('../models');
const { HTTP_STATUS } = require('../utils/constants');
const logger = require('../utils/logger');

/**
 * Authentication middleware - Verify JWT token and attach user to request
 */
const authenticate = async (req, res, next) => {
  try {
    // Extract token from Authorization header
    const token = extractTokenFromHeader(req.headers.authorization);

    if (!token) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        error: 'Authentication required',
        message: 'No token provided'
      });
    }

    // Verify token
    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (error) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        error: 'Authentication failed',
        message: error.message
      });
    }

    // Get user from database
    const user = await User.findById(decoded.id)
      .select('-password -refreshTokens')
      .populate('tenant', 'name slug isActive');

    if (!user) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        error: 'Authentication failed',
        message: 'User not found'
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

    // Attach user to request object
    req.user = user;
    req.userId = user._id;
    req.tenantId = user.tenant._id;

    next();
  } catch (error) {
    logger.error('Authentication middleware error:', error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: 'Authentication error',
      message: 'An error occurred during authentication'
    });
  }
};

/**
 * Optional authentication middleware - Attach user if token is valid, but don't require it
 */
const optionalAuthenticate = async (req, res, next) => {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);

    if (!token) {
      return next();
    }

    try {
      const decoded = verifyAccessToken(token);
      const user = await User.findById(decoded.id)
        .select('-password -refreshTokens')
        .populate('tenant', 'name slug isActive');

      if (user && user.isActive && user.tenant?.isActive) {
        req.user = user;
        req.userId = user._id;
        req.tenantId = user.tenant._id;
      }
    } catch (error) {
      // Silent fail for optional auth
      logger.debug('Optional auth failed:', error.message);
    }

    next();
  } catch (error) {
    logger.error('Optional authentication middleware error:', error);
    next();
  }
};

module.exports = {
  authenticate,
  optionalAuthenticate
};
