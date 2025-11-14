// User Roles
const USER_ROLES = {
  VIEWER: 'viewer',
  EDITOR: 'editor',
  ADMIN: 'admin'
};

// Video Status
const VIDEO_STATUS = {
  UPLOADING: 'uploading',
  QUEUED: 'queued',
  TRANSCODING: 'transcoding',
  ANALYZING: 'analyzing',
  READY: 'ready',
  FAILED: 'failed'
};

// Processing Stages
const PROCESSING_STAGES = {
  UPLOAD: 'upload',
  TRANSCODING: 'transcoding',
  THUMBNAIL: 'thumbnail',
  HLS: 'hls',
  ANALYSIS: 'analysis',
  COMPLETE: 'complete'
};

// AI Analysis Status
const AI_ANALYSIS_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  SAFE: 'safe',
  FLAGGED: 'flagged',
  BLOCKED: 'blocked'
};

// AI Content Categories
const AI_CATEGORIES = {
  HATE: 'hate',
  SELF_HARM: 'selfHarm',
  SEXUAL: 'sexual',
  VIOLENCE: 'violence'
};

// Video Categories
const VIDEO_CATEGORIES = {
  EDUCATIONAL: 'educational',
  ENTERTAINMENT: 'entertainment',
  MARKETING: 'marketing',
  TRAINING: 'training',
  OTHER: 'other'
};

// Tenant Plans
const TENANT_PLANS = {
  FREE: 'free',
  BASIC: 'basic',
  PRO: 'pro',
  ENTERPRISE: 'enterprise'
};

// Default Plan Limits
const PLAN_LIMITS = {
  [TENANT_PLANS.FREE]: {
    maxUsers: 5,
    maxStorageGB: 10,
    maxVideos: 50,
    maxVideoSizeMB: 500,
    aiAnalysisPerMonth: 100
  },
  [TENANT_PLANS.BASIC]: {
    maxUsers: 20,
    maxStorageGB: 100,
    maxVideos: 500,
    maxVideoSizeMB: 1000,
    aiAnalysisPerMonth: 1000
  },
  [TENANT_PLANS.PRO]: {
    maxUsers: 100,
    maxStorageGB: 500,
    maxVideos: 5000,
    maxVideoSizeMB: 2000,
    aiAnalysisPerMonth: 10000
  },
  [TENANT_PLANS.ENTERPRISE]: {
    maxUsers: -1, // Unlimited
    maxStorageGB: -1,
    maxVideos: -1,
    maxVideoSizeMB: 5000,
    aiAnalysisPerMonth: -1
  }
};

// Video Quality Presets
const VIDEO_QUALITIES = [
  {
    name: '1080p',
    height: 1080,
    bitrate: '5000k',
    audioBitrate: '192k'
  },
  {
    name: '720p',
    height: 720,
    bitrate: '2800k',
    audioBitrate: '128k'
  },
  {
    name: '480p',
    height: 480,
    bitrate: '1400k',
    audioBitrate: '128k'
  },
  {
    name: '360p',
    height: 360,
    bitrate: '800k',
    audioBitrate: '96k'
  }
];

// Allowed Video MIME Types
const ALLOWED_VIDEO_MIMES = [
  'video/mp4',
  'video/mpeg',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-ms-wmv',
  'video/webm'
];

// HTTP Status Codes
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
};

// Socket.IO Events
const SOCKET_EVENTS = {
  UPLOAD_PROGRESS: 'upload-progress',
  PROCESSING_PROGRESS: 'processing-progress',
  PROCESSING_COMPLETE: 'processing-complete',
  PROCESSING_ERROR: 'processing-error',
  AI_ANALYSIS_COMPLETE: 'ai-analysis-complete',
  VIDEO_READY: 'video-ready',
  NOTIFICATION: 'notification'
};

module.exports = {
  USER_ROLES,
  VIDEO_STATUS,
  PROCESSING_STAGES,
  AI_ANALYSIS_STATUS,
  AI_CATEGORIES,
  VIDEO_CATEGORIES,
  TENANT_PLANS,
  PLAN_LIMITS,
  VIDEO_QUALITIES,
  ALLOWED_VIDEO_MIMES,
  HTTP_STATUS,
  SOCKET_EVENTS
};
