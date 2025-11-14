const mongoose = require('mongoose');

const processingJobSchema = new mongoose.Schema({
  video: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Video',
    required: true
  },
  tenant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true
  },
  type: {
    type: String,
    enum: ['upload', 'transcoding', 'analysis', 'thumbnail', 'validation'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  priority: {
    type: Number,
    default: 0, // Higher number = higher priority
    min: 0,
    max: 10
  },
  progress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  stage: {
    type: String,
    default: 'queued'
  },
  result: {
    type: mongoose.Schema.Types.Mixed
  },
  error: {
    message: String,
    code: String,
    stack: String,
    timestamp: Date
  },
  metadata: {
    startedAt: Date,
    completedAt: Date,
    duration: Number, // in seconds
    retryCount: {
      type: Number,
      default: 0
    },
    maxRetries: {
      type: Number,
      default: 3
    }
  },
  worker: {
    id: String,
    name: String,
    version: String
  },
  dependencies: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProcessingJob'
  }],
  notifications: [{
    type: {
      type: String,
      enum: ['email', 'webhook', 'socket']
    },
    target: String,
    sent: {
      type: Boolean,
      default: false
    },
    sentAt: Date
  }]
}, {
  timestamps: true
});

// Indexes
processingJobSchema.index({ video: 1, type: 1 });
processingJobSchema.index({ tenant: 1, status: 1 });
processingJobSchema.index({ status: 1, priority: -1, createdAt: 1 });
processingJobSchema.index({ createdAt: 1 });

// Instance method to start processing
processingJobSchema.methods.start = async function(workerId, workerName) {
  this.status = 'processing';
  this.metadata.startedAt = new Date();
  this.worker = {
    id: workerId,
    name: workerName,
    version: process.env.npm_package_version || '1.0.0'
  };
  await this.save();
};

// Instance method to update progress
processingJobSchema.methods.updateProgress = async function(progress, stage) {
  this.progress = Math.min(100, Math.max(0, progress));
  if (stage) {
    this.stage = stage;
  }
  await this.save();
};

// Instance method to complete job
processingJobSchema.methods.complete = async function(result) {
  this.status = 'completed';
  this.progress = 100;
  this.stage = 'completed';
  this.result = result;
  this.metadata.completedAt = new Date();

  if (this.metadata.startedAt) {
    this.metadata.duration = Math.round(
      (this.metadata.completedAt - this.metadata.startedAt) / 1000
    );
  }

  await this.save();
};

// Instance method to fail job
processingJobSchema.methods.fail = async function(error) {
  this.status = 'failed';
  this.error = {
    message: error.message || 'Unknown error',
    code: error.code || 'UNKNOWN_ERROR',
    stack: error.stack,
    timestamp: new Date()
  };
  this.metadata.completedAt = new Date();

  if (this.metadata.startedAt) {
    this.metadata.duration = Math.round(
      (this.metadata.completedAt - this.metadata.startedAt) / 1000
    );
  }

  await this.save();
};

// Instance method to retry job
processingJobSchema.methods.retry = async function() {
  if (this.metadata.retryCount >= this.metadata.maxRetries) {
    throw new Error('Maximum retry attempts exceeded');
  }

  this.status = 'pending';
  this.progress = 0;
  this.stage = 'queued';
  this.error = undefined;
  this.metadata.retryCount += 1;
  this.metadata.startedAt = undefined;
  this.metadata.completedAt = undefined;
  this.metadata.duration = undefined;

  await this.save();
};

// Instance method to cancel job
processingJobSchema.methods.cancel = async function(reason) {
  this.status = 'cancelled';
  this.metadata.completedAt = new Date();
  this.error = {
    message: reason || 'Job cancelled',
    code: 'CANCELLED',
    timestamp: new Date()
  };

  await this.save();
};

// Static method to get pending jobs
processingJobSchema.statics.getPendingJobs = function(type, limit = 10) {
  const query = { status: 'pending' };

  if (type) {
    query.type = type;
  }

  return this.find(query)
    .sort({ priority: -1, createdAt: 1 })
    .limit(limit)
    .populate('video', 'title filename');
};

// Static method to get jobs by video
processingJobSchema.statics.getJobsByVideo = function(videoId) {
  return this.find({ video: videoId })
    .sort({ createdAt: -1 });
};

// Static method to clean up old completed jobs
processingJobSchema.statics.cleanupOldJobs = async function(daysOld = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const result = await this.deleteMany({
    status: { $in: ['completed', 'failed', 'cancelled'] },
    'metadata.completedAt': { $lt: cutoffDate }
  });

  return result.deletedCount;
};

// Virtual for is retryable
processingJobSchema.virtual('canRetry').get(function() {
  return this.status === 'failed' &&
         this.metadata.retryCount < this.metadata.maxRetries;
});

// Virtual for elapsed time
processingJobSchema.virtual('elapsedTime').get(function() {
  if (!this.metadata.startedAt) return 0;

  const endTime = this.metadata.completedAt || new Date();
  return Math.round((endTime - this.metadata.startedAt) / 1000);
});

// Ensure virtuals are included in JSON
processingJobSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    return ret;
  }
});

// Prevent model overwrite error by checking if model already exists
const ProcessingJob = mongoose.models.ProcessingJob || mongoose.model('ProcessingJob', processingJobSchema);

module.exports = ProcessingJob;
