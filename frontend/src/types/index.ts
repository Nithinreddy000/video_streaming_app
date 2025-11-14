// User Types
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'viewer' | 'editor' | 'admin';
  tenantId: string;
  profilePicture?: string;
  isActive: boolean;
  createdAt: string;
  lastLogin?: string;
}

// Tenant Types
export interface Tenant {
  id: string;
  name: string;
  subdomain?: string;
  domain?: string;
  plan: 'free' | 'basic' | 'pro' | 'enterprise';
  limits: TenantLimits;
  usage: TenantUsage;
  isActive: boolean;
  createdAt: string;
}

export interface TenantLimits {
  maxUsers: number;
  maxStorageGB: number;
  maxVideos: number;
  maxVideoSizeMB: number;
  aiAnalysisPerMonth: number;
}

export interface TenantUsage {
  currentUsers: number;
  currentStorageGB: number;
  currentVideos: number;
  aiAnalysisUsed: number;
  lastResetDate?: string;
}

// Video Types
export interface Video {
  id: string;
  title: string;
  description?: string;
  tags: string[];
  category: 'educational' | 'entertainment' | 'marketing' | 'training' | 'other';
  tenantId: string;
  uploadedBy: string;
  status: 'uploading' | 'queued' | 'transcoding' | 'analyzing' | 'ready' | 'failed';
  processingProgress: number;
  processingStage: 'upload' | 'transcoding' | 'thumbnail' | 'hls' | 'analysis' | 'complete';
  errorMessage?: string;
  originalFile: OriginalFile;
  processedFiles?: ProcessedFiles;
  aiAnalysis?: AIAnalysis;
  accessControl: AccessControl;
  views: number;
  avgWatchTime?: number;
  createdAt: string;
  updatedAt: string;
}

export interface OriginalFile {
  blobUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  duration?: number;
  resolution?: {
    width: number;
    height: number;
  };
  bitrate?: number;
  fps?: number;
}

export interface ProcessedFiles {
  mp4Url?: string;
  thumbnailUrl?: string;
  posterUrl?: string;
  hlsMasterPlaylist?: string;
  dashManifest?: string;
  qualities?: VideoQuality[];
}

export interface VideoQuality {
  resolution: string;
  bitrate: string;
  playlistUrl: string;
}

export interface AIAnalysis {
  status: 'pending' | 'processing' | 'safe' | 'flagged' | 'blocked';
  analyzedAt?: string;
  categories: AICategory[];
  flaggedFrames: FlaggedFrame[];
  overallScore?: number;
  reviewRequired: boolean;
  reviewedBy?: string;
  reviewNotes?: string;
}

export interface AICategory {
  name: 'hate' | 'selfHarm' | 'sexual' | 'violence';
  severity: number;
}

export interface FlaggedFrame {
  timestamp: number;
  category: string;
  severity: number;
  thumbnailUrl?: string;
}

export interface AccessControl {
  isPublic: boolean;
  allowedRoles: string[];
  allowedUsers: string[];
  requiresApproval: boolean;
}

// Auth Types
export interface LoginCredentials {
  email: string;
  password: string;
  tenantId?: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  tenantName: string;
}

export interface AuthResponse {
  message: string;
  user: User;
  tenant?: Tenant;
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: string;
  };
}

// API Response Types
export interface APIResponse<T> {
  data?: T;
  message?: string;
  error?: string;
  details?: string[];
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Upload Types
export interface UploadProgress {
  videoId?: string;
  progress: number;
  status: 'idle' | 'uploading' | 'processing' | 'complete' | 'error';
  error?: string;
}

// Analytics Types
export interface Analytics {
  totalVideos: number;
  totalViews: number;
  totalStorageGB: number;
  totalWatchTime: number;
  videosProcessing: number;
  videosFlagged: number;
  popularVideos: Video[];
  viewsByDay: ChartData[];
  uploadsByDay: ChartData[];
  storageByCategory: ChartData[];
}

export interface ChartData {
  label: string;
  value: number;
  date?: string;
}

// Socket.IO Event Types
export interface ProcessingProgressEvent {
  videoId: string;
  stage: string;
  progress: number;
  status: string;
}

export interface ProcessingCompleteEvent {
  videoId: string;
  status: string;
  categories?: Record<string, number>;
  flaggedFrames?: number;
}

export interface NotificationEvent {
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  videoId?: string;
}
