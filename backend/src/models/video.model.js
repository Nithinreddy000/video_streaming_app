module.exports = require('./video.model');
const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Video title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  filename: {
    type: String,
    required: [true, 'Filename is required']
  },
  originalFilename: {
    type: String,
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  duration: {
    type: Number, // in seconds
    default: 0
  },
  resolution: {
    width: Number,
    height: Number
  },
  codec: {
    video: String,
    audio: String
  },
  bitrate: {
    type: Number // in kbps
  },
  fps: {
    type: Number
  },
  blobUrl: {
    type: String,
    required: false,
    default: ''
  },
  cdnUrl: {
    type: String
  },
  thumbnailUrl: {
    type: String
  },
  processedFiles: {
    mp4: {
      type: Map,
      of: String  // { '1080p': 'url', '720p': 'url', '480p': 'url', '360p': 'url' }
    },
    hls: String,  // HLS master playlist URL
    dash: String,  // DASH manifest URL (optional)
    thumbnail: String,  // Processed thumbnail URL
    poster: String,  // Poster image URL
    qualities: [{
      resolution: String,  // '1080p', '720p', '480p', '360p'
      bitrate: String,
      url: String
    }]
  },
  status: {
    type: String,
    enum: ['uploading', 'processing', 'transcoding', 'analyzing', 'ready', 'failed'],
    default: 'uploading'
  },
  processingProgress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  processingStage: {
    type: String,
    enum: ['upload', 'validation', 'transcoding', 'analysis', 'finalization', 'completed'],
    default: 'upload'
  },
  sensitivityScore: {
    type: Number,
    min: 0,
    max: 1,
    default: null
  },
  classification: {
    type: String,
    enum: ['safe', 'flagged', 'reviewing', 'pending'],
    default: 'pending'
  },
  analysisResults: {
    adultContent: {
      score: Number,
      detected: Boolean
    },
    violenceContent: {
      score: Number,
      detected: Boolean
    },
    explicitContent: {
      score: Number,
      detected: Boolean
    },
    textContent: [{
      text: String,
      confidence: Number
    }],
    labels: [String],
    analyzedAt: Date
  },
  moderationNotes: {
    type: String,
    maxlength: [1000, 'Moderation notes cannot exceed 1000 characters']
  },
  moderatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  moderatedAt: {
    type: Date
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  tenant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true
  },
  tags: [{
    type: String,
    trim: true
  }],
  category: {
    type: String,
    trim: true
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  accessControl: {
    isPublic: {
      type: Boolean,
      default: false
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant'
    },
    allowedRoles: [{
      type: String,
      enum: ['viewer', 'editor', 'admin']
    }]
  },
  viewCount: {
    type: Number,
    default: 0
  },
  lastViewedAt: {
    type: Date
  },
  error: {
    message: String,
    stage: String,
    timestamp: Date
  },
  aiAnalysis: {
    status: {
      type: String,
      enum: ['safe', 'flagged', 'blocked', 'error'],
      default: 'safe'
    },
    categories: [{
      name: String,
      severity: Number
    }],
    overallScore: {
      type: Number,
      default: 0
    },
    analyzedAt: Date,
    error: String
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
videoSchema.index({ uploadedBy: 1, tenant: 1 });
videoSchema.index({ tenant: 1, status: 1 });
videoSchema.index({ tenant: 1, classification: 1 });
videoSchema.index({ tenant: 1, createdAt: -1 });
videoSchema.index({ tenant: 1, title: 'text', description: 'text' });
videoSchema.index({ tags: 1 });
videoSchema.index({ 'accessControl.organization': 1, 'accessControl.allowedRoles': 1 });
videoSchema.index({ 'accessControl.isPublic': 1 });

// Virtual for stream URL
videoSchema.virtual('streamUrl').get(function() {
  if (this.status === 'ready' && this.cdnUrl) {
    return this.cdnUrl;
  }
  return null;
});

// Virtual for processing percentage
videoSchema.virtual('processingPercentage').get(function() {
  return Math.round(this.processingProgress);
});

// Instance method to update processing progress
videoSchema.methods.updateProgress = async function(stage, progress) {
  this.processingStage = stage;
  this.processingProgress = progress;

  // Update status based on stage
  if (stage === 'completed') {
    this.status = 'ready';
  } else if (stage === 'analysis') {
    this.status = 'analyzing';
  } else if (stage === 'transcoding') {
    this.status = 'transcoding';
  } else {
    this.status = 'processing';
  }

  await this.save();
};

// Instance method to mark as failed
videoSchema.methods.markAsFailed = async function(errorMessage, stage) {
  this.status = 'failed';
  this.error = {
    message: errorMessage,
    stage: stage || this.processingStage,
    timestamp: new Date()
  };
  await this.save();
};

// Instance method to update analysis results
videoSchema.methods.updateAnalysis = async function(results) {
  this.analysisResults = results;

  // Calculate overall sensitivity score
  const scores = [
    results.adultContent?.score || 0,
    results.violenceContent?.score || 0,
    results.explicitContent?.score || 0
  ];
  this.sensitivityScore = Math.max(...scores);

  // Classify based on sensitivity score
  if (this.sensitivityScore >= 0.7) {
    this.classification = 'flagged';
  } else if (this.sensitivityScore >= 0.4) {
    this.classification = 'reviewing';
  } else {
    this.classification = 'safe';
  }

  this.analysisResults.analyzedAt = new Date();
  await this.save();
};

// Instance method to increment view count
videoSchema.methods.incrementViewCount = async function() {
  this.viewCount += 1;
  this.lastViewedAt = new Date();
  await this.save();
};

// Static method to get videos by tenant with filtering and access control
videoSchema.statics.findByTenant = function(tenantId, filters = {}) {
  const query = { tenant: tenantId };

  // Access control filtering
  if (filters.userRole && filters.userId) {
    // User can see:
    // 1. Public videos
    // 2. Videos they uploaded
    // 3. Videos where their organization and role match access control
    query.$or = [
      { 'accessControl.isPublic': true },
      { isPublic: true }, // Legacy support
      { uploadedBy: filters.userId },
      {
        $and: [
          { 'accessControl.organization': tenantId },
          { 'accessControl.allowedRoles': { $in: [filters.userRole] } }
        ]
      }
    ];
  }

  if (filters.status) {
    query.status = filters.status;
  }

  if (filters.classification) {
    query.classification = filters.classification;
  }

  if (filters.uploadedBy) {
    query.uploadedBy = filters.uploadedBy;
  }

  if (filters.search) {
    query.$text = { $search: filters.search };
  }

  if (filters.tags && filters.tags.length > 0) {
    query.tags = { $in: filters.tags };
  }

  return this.find(query)
    .populate('uploadedBy', 'username email')
    .populate('accessControl.organization', 'name slug')
    .sort({ createdAt: -1 });
};

// Ensure virtuals are included in JSON
videoSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

// Prevent model overwrite error by checking if model already exists
const Video = mongoose.models.Video || mongoose.model('Video', videoSchema);

module.exports = Video;
