const mongoose = require('mongoose');
const crypto = require('crypto');

const invitationSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
  },
  tenant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: [true, 'Tenant is required']
  },
  role: {
    type: String,
    enum: ['viewer', 'editor', 'admin'],
    default: 'viewer'
  },
  token: {
    type: String,
    required: true,
    unique: true
  },
  invitedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'expired', 'cancelled'],
    default: 'pending'
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 } // TTL index - auto-delete expired invitations
  },
  acceptedAt: {
    type: Date
  },
  acceptedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes
invitationSchema.index({ email: 1, tenant: 1 });
invitationSchema.index({ token: 1 });
invitationSchema.index({ status: 1 });
invitationSchema.index({ expiresAt: 1 });

// Pre-save hook to generate token
invitationSchema.pre('save', function(next) {
  // Only generate token if it's a new invitation or token is not set
  if (!this.token) {
    this.token = crypto.randomBytes(32).toString('hex');
  }

  // Set expiration if not set (default: 7 days)
  if (!this.expiresAt) {
    this.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  }

  next();
});

// Instance method to check if invitation is valid
invitationSchema.methods.isValid = function() {
  return (
    this.status === 'pending' &&
    this.expiresAt > new Date()
  );
};

// Instance method to mark invitation as accepted
invitationSchema.methods.accept = async function(userId) {
  this.status = 'accepted';
  this.acceptedAt = new Date();
  this.acceptedBy = userId;
  await this.save();
};

// Instance method to cancel invitation
invitationSchema.methods.cancel = async function() {
  this.status = 'cancelled';
  await this.save();
};

// Static method to get pending invitations for a tenant
invitationSchema.statics.getPendingInvitations = function(tenantId) {
  return this.find({
    tenant: tenantId,
    status: 'pending',
    expiresAt: { $gt: new Date() }
  }).populate('invitedBy', 'username email');
};

// Static method to clean up expired invitations (manual cleanup)
invitationSchema.statics.cleanupExpired = async function() {
  const result = await this.updateMany(
    {
      status: 'pending',
      expiresAt: { $lt: new Date() }
    },
    {
      status: 'expired'
    }
  );
  return result;
};

// Prevent model overwrite error
const Invitation = mongoose.models.Invitation || mongoose.model('Invitation', invitationSchema);

module.exports = Invitation;
