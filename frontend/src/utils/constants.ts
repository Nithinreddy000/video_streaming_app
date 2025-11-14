// API Configuration
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

// Upload Configuration
export const MAX_UPLOAD_SIZE = parseInt(import.meta.env.VITE_MAX_UPLOAD_SIZE) || 2147483648; // 2GB
export const CHUNK_SIZE = parseInt(import.meta.env.VITE_CHUNK_SIZE) || 5242880; // 5MB

// App Configuration
export const APP_NAME = import.meta.env.VITE_APP_NAME || 'VideoSentinel';

// User Roles
export const USER_ROLES = {
  VIEWER: 'viewer',
  EDITOR: 'editor',
  ADMIN: 'admin',
} as const;

// Video Status
export const VIDEO_STATUS = {
  UPLOADING: 'uploading',
  QUEUED: 'queued',
  TRANSCODING: 'transcoding',
  ANALYZING: 'analyzing',
  READY: 'ready',
  FAILED: 'failed',
} as const;

// Processing Stages
export const PROCESSING_STAGES = {
  UPLOAD: 'upload',
  TRANSCODING: 'transcoding',
  THUMBNAIL: 'thumbnail',
  HLS: 'hls',
  ANALYSIS: 'analysis',
  COMPLETE: 'complete',
} as const;

// AI Analysis Status
export const AI_ANALYSIS_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  SAFE: 'safe',
  FLAGGED: 'flagged',
  BLOCKED: 'blocked',
} as const;

// AI Content Categories
export const AI_CATEGORIES = {
  HATE: 'hate',
  SELF_HARM: 'selfHarm',
  SEXUAL: 'sexual',
  VIOLENCE: 'violence',
} as const;

// Video Categories
export const VIDEO_CATEGORIES = [
  'Educational',
  'Entertainment',
  'Marketing',
  'Training',
  'Tutorial',
  'News',
  'Sports',
  'Music',
  'Gaming',
  'Other',
] as const;

// Tenant Plans
export const TENANT_PLANS = {
  FREE: 'free',
  BASIC: 'basic',
  PRO: 'pro',
  ENTERPRISE: 'enterprise',
} as const;

// HTTP Status Codes
export const HTTP_STATUS = {
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
  SERVICE_UNAVAILABLE: 503,
} as const;

// Socket.IO Events
export const SOCKET_EVENTS = {
  UPLOAD_PROGRESS: 'upload-progress',
  PROCESSING_PROGRESS: 'processing-progress',
  PROCESSING_COMPLETE: 'processing-complete',
  PROCESSING_ERROR: 'processing-error',
  AI_ANALYSIS_COMPLETE: 'ai-analysis-complete',
  VIDEO_READY: 'video-ready',
  NOTIFICATION: 'notification',
} as const;

// Local Storage Keys
export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  USER: 'user',
  THEME: 'theme',
} as const;

// Pagination
export const DEFAULT_PAGE_SIZE = 20;
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

// Routes
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  DASHBOARD: '/dashboard',
  UPLOAD: '/upload',
  LIBRARY: '/library',
  VIDEOS: '/videos',
  VIDEO_DETAIL: '/videos/:id',
  ANALYTICS: '/analytics',
  SETTINGS: '/settings',
  ADMIN: '/admin',
} as const;

// Allowed Video MIME Types
export const ALLOWED_VIDEO_MIMES = [
  'video/mp4',
  'video/mpeg',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-ms-wmv',
  'video/webm',
];

// Allowed Video Extensions
export const ALLOWED_VIDEO_EXTENSIONS = [
  '.mp4',
  '.mpeg',
  '.mov',
  '.avi',
  '.wmv',
  '.webm',
];
