const { Tenant, User } = require('../../models');
const { HTTP_STATUS } = require('../../utils/constants');
const logger = require('../../utils/logger');

/**
 * Get all organizations/tenants
 * GET /api/v1/tenants
 * @access Admin only
 */
const getAllTenants = async (req, res) => {
  try {
    // Build query
    const query = {};

    // Filter by active status if provided
    if (req.query.isActive !== undefined) {
      query.isActive = req.query.isActive === 'true';
    }

    // Filter by subscription status if provided
    if (req.query.subscriptionStatus) {
      query['subscription.status'] = req.query.subscriptionStatus;
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
    const tenants = await Tenant.find(query)
      .populate('createdBy', 'username email')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    // Get total count
    const total = await Tenant.countDocuments(query);

    res.status(HTTP_STATUS.OK).json({
      tenants,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit
      }
    });
  } catch (error) {
    logger.error('Get all tenants error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: 'Failed to fetch tenants',
      message: error.message
    });
  }
};

/**
 * Get single tenant by ID
 * GET /api/v1/tenants/:id
 * @access Admin only
 */
const getTenantById = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id)
      .populate('createdBy', 'username email fullName');

    if (!tenant) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Tenant not found',
        message: 'The specified organization does not exist'
      });
    }

    // Get user count for this tenant
    const userCount = await User.countDocuments({ tenant: tenant._id });

    // Add user count to response
    const tenantData = tenant.toJSON();
    tenantData.usage.totalUsers = userCount;

    res.status(HTTP_STATUS.OK).json({ tenant: tenantData });
  } catch (error) {
    logger.error('Get tenant by ID error:', error);

    if (error.name === 'CastError') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Invalid tenant ID',
        message: 'The provided tenant ID is not valid'
      });
    }

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: 'Failed to fetch tenant',
      message: error.message
    });
  }
};

/**
 * Create new organization/tenant
 * POST /api/v1/tenants
 * @access Admin only
 */
const createTenant = async (req, res) => {
  try {
    const { name, slug, description, settings, subscription, contactInfo } = req.body;

    // Validation
    if (!name) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Validation error',
        message: 'Organization name is required'
      });
    }

    // Check if tenant with same name or slug already exists
    const existingTenant = await Tenant.findOne({
      $or: [{ name }, { slug: slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-') }]
    });

    if (existingTenant) {
      return res.status(HTTP_STATUS.CONFLICT).json({
        error: 'Tenant already exists',
        message: existingTenant.name === name
          ? 'An organization with this name already exists'
          : 'An organization with this slug already exists'
      });
    }

    // Create tenant
    const tenant = await Tenant.create({
      name,
      slug,
      description,
      settings,
      subscription,
      contactInfo,
      createdBy: req.user._id,
      isActive: true
    });

    logger.info(`New tenant created: ${tenant.name} (${tenant.slug}) by admin ${req.user.email}`);

    res.status(HTTP_STATUS.CREATED).json({
      message: 'Organization created successfully',
      tenant
    });
  } catch (error) {
    logger.error('Create tenant error:', error);

    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(HTTP_STATUS.CONFLICT).json({
        error: 'Duplicate error',
        message: `Organization ${field} already exists`
      });
    }

    if (error.name === 'ValidationError') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Validation error',
        message: Object.values(error.errors).map(e => e.message).join(', ')
      });
    }

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: 'Failed to create tenant',
      message: error.message
    });
  }
};

/**
 * Update tenant
 * PUT /api/v1/tenants/:id
 * @access Admin only
 */
const updateTenant = async (req, res) => {
  try {
    const { name, slug, description, settings, subscription, contactInfo, isActive } = req.body;

    const tenant = await Tenant.findById(req.params.id);

    if (!tenant) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Tenant not found',
        message: 'The specified organization does not exist'
      });
    }

    // Update fields if provided
    if (name !== undefined) tenant.name = name;
    if (slug !== undefined) tenant.slug = slug;
    if (description !== undefined) tenant.description = description;
    if (isActive !== undefined) tenant.isActive = isActive;

    // Update nested objects
    if (settings) {
      tenant.settings = { ...tenant.settings.toObject(), ...settings };
    }

    if (subscription) {
      tenant.subscription = { ...tenant.subscription.toObject(), ...subscription };
    }

    if (contactInfo) {
      tenant.contactInfo = { ...tenant.contactInfo.toObject(), ...contactInfo };
    }

    await tenant.save();

    logger.info(`Tenant updated: ${tenant.name} (${tenant.slug}) by admin ${req.user.email}`);

    res.status(HTTP_STATUS.OK).json({
      message: 'Organization updated successfully',
      tenant
    });
  } catch (error) {
    logger.error('Update tenant error:', error);

    if (error.name === 'CastError') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Invalid tenant ID',
        message: 'The provided tenant ID is not valid'
      });
    }

    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(HTTP_STATUS.CONFLICT).json({
        error: 'Duplicate error',
        message: `Organization ${field} already exists`
      });
    }

    if (error.name === 'ValidationError') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Validation error',
        message: Object.values(error.errors).map(e => e.message).join(', ')
      });
    }

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: 'Failed to update tenant',
      message: error.message
    });
  }
};

/**
 * Deactivate tenant (soft delete)
 * DELETE /api/v1/tenants/:id
 * @access Admin only
 */
const deactivateTenant = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id);

    if (!tenant) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Tenant not found',
        message: 'The specified organization does not exist'
      });
    }

    // Check if tenant has active users
    const activeUsers = await User.countDocuments({
      tenant: tenant._id,
      isActive: true
    });

    if (activeUsers > 0 && !req.query.force) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Cannot deactivate tenant',
        message: `This organization has ${activeUsers} active users. Deactivate users first or use ?force=true`,
        activeUsers
      });
    }

    // Deactivate tenant
    tenant.isActive = false;
    tenant.subscription.status = 'suspended';
    await tenant.save();

    // Optionally deactivate all users if force=true
    if (req.query.force === 'true') {
      await User.updateMany(
        { tenant: tenant._id },
        { isActive: false }
      );
      logger.info(`Deactivated all users in tenant ${tenant.name}`);
    }

    logger.info(`Tenant deactivated: ${tenant.name} (${tenant.slug}) by admin ${req.user.email}`);

    res.status(HTTP_STATUS.OK).json({
      message: 'Organization deactivated successfully',
      tenant
    });
  } catch (error) {
    logger.error('Deactivate tenant error:', error);

    if (error.name === 'CastError') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Invalid tenant ID',
        message: 'The provided tenant ID is not valid'
      });
    }

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: 'Failed to deactivate tenant',
      message: error.message
    });
  }
};

/**
 * Get users in a tenant
 * GET /api/v1/tenants/:id/users
 * @access Admin only
 */
const getTenantUsers = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id);

    if (!tenant) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Tenant not found',
        message: 'The specified organization does not exist'
      });
    }

    // Build query
    const query = { tenant: tenant._id };

    // Filter by role if provided
    if (req.query.role) {
      query.role = req.query.role;
    }

    // Filter by active status if provided
    if (req.query.isActive !== undefined) {
      query.isActive = req.query.isActive === 'true';
    }

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Get users
    const users = await User.find(query)
      .select('-password -refreshTokens')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Get total count
    const total = await User.countDocuments(query);

    res.status(HTTP_STATUS.OK).json({
      users,
      tenant: {
        id: tenant._id,
        name: tenant.name,
        slug: tenant.slug
      },
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit
      }
    });
  } catch (error) {
    logger.error('Get tenant users error:', error);

    if (error.name === 'CastError') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Invalid tenant ID',
        message: 'The provided tenant ID is not valid'
      });
    }

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: 'Failed to fetch tenant users',
      message: error.message
    });
  }
};

/**
 * Get tenant statistics
 * GET /api/v1/tenants/:id/stats
 * @access Admin only
 */
const getTenantStats = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id);

    if (!tenant) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Tenant not found',
        message: 'The specified organization does not exist'
      });
    }

    // Get user statistics
    const totalUsers = await User.countDocuments({ tenant: tenant._id });
    const activeUsers = await User.countDocuments({ tenant: tenant._id, isActive: true });
    const usersByRole = await User.aggregate([
      { $match: { tenant: tenant._id } },
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);

    const stats = {
      tenant: {
        id: tenant._id,
        name: tenant.name,
        slug: tenant.slug
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
      storage: {
        used: tenant.usage.totalStorageUsedGB,
        limit: tenant.settings.maxStorageGB,
        percentage: tenant.storageUsagePercentage
      },
      videos: {
        total: tenant.usage.totalVideos
      },
      subscription: {
        plan: tenant.subscription.plan,
        status: tenant.subscription.status
      }
    };

    res.status(HTTP_STATUS.OK).json({ stats });
  } catch (error) {
    logger.error('Get tenant stats error:', error);

    if (error.name === 'CastError') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Invalid tenant ID',
        message: 'The provided tenant ID is not valid'
      });
    }

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: 'Failed to fetch tenant statistics',
      message: error.message
    });
  }
};

module.exports = {
  getAllTenants,
  getTenantById,
  createTenant,
  updateTenant,
  deactivateTenant,
  getTenantUsers,
  getTenantStats
};
