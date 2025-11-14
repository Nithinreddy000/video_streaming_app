const mongoose = require('mongoose');

const tenantSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Tenant name is required'],
    unique: true,
    trim: true,
    maxlength: [100, 'Tenant name cannot exceed 100 characters']
  },
  slug: {
    type: String,
    required: [true, 'Tenant slug is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  settings: {
    maxStorageGB: {
      type: Number,
      default: 100 // 100 GB default
    },
    maxVideoSizeMB: {
      type: Number,
      default: 500 // 500 MB default
    },
    allowedVideoFormats: {
      type: [String],
      default: ['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm']
    },
    maxVideoDurationMinutes: {
      type: Number,
      default: 120 // 2 hours default
    },
    enableAutoModeration: {
      type: Boolean,
      default: true
    },
    moderationThreshold: {
      type: Number,
      default: 0.7, // Auto-flag if sensitivity > 0.7
      min: 0,
      max: 1
    },
    allowPublicSharing: {
      type: Boolean,
      default: false
    },
    customBranding: {
      logoUrl: String,
      primaryColor: String,
      secondaryColor: String
    }
  },
  subscription: {
    plan: {
      type: String,
      enum: ['free', 'basic', 'professional', 'enterprise'],
      default: 'free'
    },
    status: {
      type: String,
      enum: ['active', 'suspended', 'cancelled', 'trial'],
      default: 'trial'
    },
    startDate: {
      type: Date,
      default: Date.now
    },
    endDate: {
      type: Date
    },
    features: {
      type: [String],
      default: []
    }
  },
  usage: {
    totalStorageUsedGB: {
      type: Number,
      default: 0
    },
    totalVideos: {
      type: Number,
      default: 0
    },
    totalUsers: {
      type: Number,
      default: 0
    },
    totalStreams: {
      type: Number,
      default: 0
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },
  contactInfo: {
    email: {
      type: String,
      trim: true,
      lowercase: true
    },
    phone: {
      type: String,
      trim: true
    },
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
      zipCode: String
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes (slug already has unique: true, so no need to index again)
tenantSchema.index({ isActive: 1 });
tenantSchema.index({ 'subscription.status': 1 });

// Pre-save hook to generate slug from name if not provided
tenantSchema.pre('save', function(next) {
  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  next();
});

// Instance method to check if tenant has reached storage limit
tenantSchema.methods.hasReachedStorageLimit = function() {
  return this.usage.totalStorageUsedGB >= this.settings.maxStorageGB;
};

// Instance method to check if tenant can upload video
tenantSchema.methods.canUploadVideo = function(videoSizeMB) {
  // Check storage limit
  const additionalStorageGB = videoSizeMB / 1024;
  if (this.usage.totalStorageUsedGB + additionalStorageGB > this.settings.maxStorageGB) {
    return {
      allowed: false,
      reason: 'Storage limit exceeded'
    };
  }

  // Check video size limit
  if (videoSizeMB > this.settings.maxVideoSizeMB) {
    return {
      allowed: false,
      reason: `Video size exceeds ${this.settings.maxVideoSizeMB}MB limit`
    };
  }

  // Check subscription status
  if (this.subscription.status !== 'active' && this.subscription.status !== 'trial') {
    return {
      allowed: false,
      reason: 'Subscription not active'
    };
  }

  return { allowed: true };
};

// Instance method to update storage usage
tenantSchema.methods.updateStorageUsage = async function(sizeMB, increment = true) {
  const sizeGB = sizeMB / 1024;

  if (increment) {
    this.usage.totalStorageUsedGB += sizeGB;
    this.usage.totalVideos += 1;
  } else {
    this.usage.totalStorageUsedGB = Math.max(0, this.usage.totalStorageUsedGB - sizeGB);
    this.usage.totalVideos = Math.max(0, this.usage.totalVideos - 1);
  }

  this.usage.lastUpdated = new Date();
  await this.save();
};

// Instance method to increment stream count
tenantSchema.methods.incrementStreamCount = async function() {
  this.usage.totalStreams += 1;
  this.usage.lastUpdated = new Date();
  await this.save();
};

// Static method to get active tenants
tenantSchema.statics.getActiveTenants = function() {
  return this.find({
    isActive: true,
    'subscription.status': { $in: ['active', 'trial'] }
  });
};

// Virtual for storage usage percentage
tenantSchema.virtual('storageUsagePercentage').get(function() {
  if (this.settings.maxStorageGB === 0) return 0;
  return Math.round((this.usage.totalStorageUsedGB / this.settings.maxStorageGB) * 100);
});

// Ensure virtuals are included in JSON
tenantSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    return ret;
  }
});

// Prevent model overwrite error by checking if model already exists
const Tenant = mongoose.models.Tenant || mongoose.model('Tenant', tenantSchema);

module.exports = Tenant;
