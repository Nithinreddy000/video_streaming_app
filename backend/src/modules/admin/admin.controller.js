const { User, Tenant } = require('../../models');
const { HTTP_STATUS } = require('../../utils/constants');
const logger = require('../../utils/logger');

/**
 * Get all users across all tenants
 * GET /api/v1/admin/users
 * @access Admin only
 */
const getAllUsers = async (req, res) => {
  try {
    // Build query
    const query = {};

    // Filter by tenant if provided
    if (req.query.tenantId) {
      query.tenant = req.query.tenantId;
    }

    // Filter by role if provided
    if (req.query.role) {
      query.role = req.query.role;
    }

    // Filter by active status if provided
    if (req.query.isActive !== undefined) {
      query.isActive = req.query.isActive === 'true';
    }

    // Search by username or email
    if (req.query.search) {
      query.$or = [
        { username: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } },
        { firstName: { $regex: req.query.search, $options: 'i' } },
        { lastName: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Sort
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    const sort = { [sortBy]: sortOrder };

    // Execute query
    const users = await User.find(query)
      .populate('tenant', 'name slug isActive')
      .select('-password -refreshTokens')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    // Get total count
    const total = await User.countDocuments(query);

    res.status(HTTP_STATUS.OK).json({
      users,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit
      }
    });
  } catch (error) {
    logger.error('Get all users error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: 'Failed to fetch users',
      message: error.message
    });
  }
};

/**
 * Get single user by ID
 * GET /api/v1/admin/users/:id
 * @access Admin only
 */
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .populate('tenant', 'name slug isActive subscription')
      .select('-password -refreshTokens');

    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'User not found',
        message: 'The specified user does not exist'
      });
    }

    res.status(HTTP_STATUS.OK).json({ user });
  } catch (error) {
    logger.error('Get user by ID error:', error);

    if (error.name === 'CastError') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Invalid user ID',
        message: 'The provided user ID is not valid'
      });
    }

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: 'Failed to fetch user',
      message: error.message
    });
  }
};

/**
 * Create new user
 * POST /api/v1/admin/users
 * @access Admin only
 */
const createUser = async (req, res) => {
  try {
    const { username, email, password, firstName, lastName, role, tenantId } = req.body;

    // Validation
    if (!username || !email || !password || !tenantId) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Validation error',
        message: 'Username, email, password, and tenantId are required'
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

    // Verify tenant exists
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Tenant not found',
        message: 'The specified organization does not exist'
      });
    }

    // Create user
    const user = await User.create({
      username,
      email,
      password, // Will be hashed by pre-save hook
      firstName,
      lastName,
      role: role || 'viewer',
      tenant: tenantId,
      isActive: true
    });

    // Update tenant user count
    await tenant.updateOne({ $inc: { 'usage.totalUsers': 1 } });

    logger.info(`New user created: ${user.email} (${user.username}) in tenant ${tenant.name} by admin ${req.user.email}`);

    // Remove sensitive data
    const userResponse = user.toJSON();
    delete userResponse.password;
    delete userResponse.refreshTokens;

    res.status(HTTP_STATUS.CREATED).json({
      message: 'User created successfully',
      user: userResponse
    });
  } catch (error) {
    logger.error('Create user error:', error);

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
      error: 'Failed to create user',
      message: error.message
    });
  }
};

/**
 * Update user
 * PUT /api/v1/admin/users/:id
 * @access Admin only
 */
const updateUser = async (req, res) => {
  try {
    const { username, email, firstName, lastName, role, isActive } = req.body;

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'User not found',
        message: 'The specified user does not exist'
      });
    }

    // Update fields if provided
    if (username !== undefined) user.username = username;
    if (email !== undefined) user.email = email;
    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;
    if (role !== undefined) user.role = role;
    if (isActive !== undefined) user.isActive = isActive;

    await user.save();

    // Populate tenant info
    await user.populate('tenant', 'name slug isActive');

    logger.info(`User updated: ${user.email} (${user.username}) by admin ${req.user.email}`);

    // Remove sensitive data
    const userResponse = user.toJSON();
    delete userResponse.password;
    delete userResponse.refreshTokens;

    res.status(HTTP_STATUS.OK).json({
      message: 'User updated successfully',
      user: userResponse
    });
  } catch (error) {
    logger.error('Update user error:', error);

    if (error.name === 'CastError') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Invalid user ID',
        message: 'The provided user ID is not valid'
      });
    }

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
      error: 'Failed to update user',
      message: error.message
    });
  }
};

/**
 * Deactivate user (soft delete)
 * DELETE /api/v1/admin/users/:id
 * @access Admin only
 */
const deactivateUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate('tenant', 'name slug');

    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'User not found',
        message: 'The specified user does not exist'
      });
    }

    // Prevent admin from deactivating themselves
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Cannot deactivate self',
        message: 'You cannot deactivate your own account'
      });
    }

    user.isActive = false;
    await user.save();

    logger.info(`User deactivated: ${user.email} (${user.username}) by admin ${req.user.email}`);

    res.status(HTTP_STATUS.OK).json({
      message: 'User deactivated successfully',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        isActive: user.isActive
      }
    });
  } catch (error) {
    logger.error('Deactivate user error:', error);

    if (error.name === 'CastError') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Invalid user ID',
        message: 'The provided user ID is not valid'
      });
    }

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: 'Failed to deactivate user',
      message: error.message
    });
  }
};

/**
 * Change user role
 * PUT /api/v1/admin/users/:id/role
 * @access Admin only
 */
const changeUserRole = async (req, res) => {
  try {
    const { role } = req.body;

    if (!role) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Validation error',
        message: 'Role is required'
      });
    }

    const validRoles = ['viewer', 'editor', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Invalid role',
        message: `Role must be one of: ${validRoles.join(', ')}`
      });
    }

    const user = await User.findById(req.params.id).populate('tenant', 'name slug');

    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'User not found',
        message: 'The specified user does not exist'
      });
    }

    const oldRole = user.role;
    user.role = role;
    await user.save();

    logger.info(`User role changed: ${user.email} from ${oldRole} to ${role} by admin ${req.user.email}`);

    res.status(HTTP_STATUS.OK).json({
      message: 'User role updated successfully',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        tenant: user.tenant
      }
    });
  } catch (error) {
    logger.error('Change user role error:', error);

    if (error.name === 'CastError') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Invalid user ID',
        message: 'The provided user ID is not valid'
      });
    }

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: 'Failed to change user role',
      message: error.message
    });
  }
};

/**
 * Move user to different tenant/organization
 * PUT /api/v1/admin/users/:id/tenant
 * @access Admin only
 */
const changeUserTenant = async (req, res) => {
  try {
    const { tenantId } = req.body;

    if (!tenantId) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Validation error',
        message: 'Tenant ID is required'
      });
    }

    const user = await User.findById(req.params.id).populate('tenant', 'name slug');

    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'User not found',
        message: 'The specified user does not exist'
      });
    }

    // Verify new tenant exists
    const newTenant = await Tenant.findById(tenantId);
    if (!newTenant) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Tenant not found',
        message: 'The specified organization does not exist'
      });
    }

    const oldTenantId = user.tenant._id;
    const oldTenantName = user.tenant.name;

    // Update user tenant
    user.tenant = tenantId;
    await user.save();

    // Update user counts
    await Tenant.findByIdAndUpdate(oldTenantId, { $inc: { 'usage.totalUsers': -1 } });
    await Tenant.findByIdAndUpdate(tenantId, { $inc: { 'usage.totalUsers': 1 } });

    // Populate new tenant info
    await user.populate('tenant', 'name slug isActive');

    logger.info(`User moved: ${user.email} from ${oldTenantName} to ${newTenant.name} by admin ${req.user.email}`);

    res.status(HTTP_STATUS.OK).json({
      message: 'User moved to new organization successfully',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        tenant: user.tenant
      }
    });
  } catch (error) {
    logger.error('Change user tenant error:', error);

    if (error.name === 'CastError') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Invalid ID',
        message: 'The provided ID is not valid'
      });
    }

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: 'Failed to move user',
      message: error.message
    });
  }
};

/**
 * Get system statistics
 * GET /api/v1/admin/stats
 * @access Admin only
 */
const getSystemStats = async (req, res) => {
  try {
    // Get total counts
    const totalTenants = await Tenant.countDocuments();
    const activeTenants = await Tenant.countDocuments({ isActive: true });
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });

    // Get users by role
    const usersByRole = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);

    // Get tenants by subscription plan
    const tenantsByPlan = await Tenant.aggregate([
      { $group: { _id: '$subscription.plan', count: { $sum: 1 } } }
    ]);

    // Get storage usage
    const storageUsage = await Tenant.aggregate([
      {
        $group: {
          _id: null,
          totalStorageUsed: { $sum: '$usage.totalStorageUsedGB' },
          totalStorageLimit: { $sum: '$settings.maxStorageGB' },
          totalVideos: { $sum: '$usage.totalVideos' },
          totalStreams: { $sum: '$usage.totalStreams' }
        }
      }
    ]);

    const stats = {
      tenants: {
        total: totalTenants,
        active: activeTenants,
        inactive: totalTenants - activeTenants,
        byPlan: tenantsByPlan.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {})
      },
      users: {
        total: totalUsers,
        active: activeUsers,
        inactive: totalUsers - activeUsers,
        byRole: usersByRole.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {})
      },
      storage: storageUsage.length > 0 ? {
        totalUsedGB: storageUsage[0].totalStorageUsed,
        totalLimitGB: storageUsage[0].totalStorageLimit,
        totalVideos: storageUsage[0].totalVideos,
        totalStreams: storageUsage[0].totalStreams
      } : {
        totalUsedGB: 0,
        totalLimitGB: 0,
        totalVideos: 0,
        totalStreams: 0
      }
    };

    res.status(HTTP_STATUS.OK).json({ stats });
  } catch (error) {
    logger.error('Get system stats error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: 'Failed to fetch system statistics',
      message: error.message
    });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deactivateUser,
  changeUserRole,
  changeUserTenant,
  getSystemStats
};
