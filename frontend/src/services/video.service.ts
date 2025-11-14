import apiService from './api.service';
import type { Video, VideoStatus, AIAnalysisStatus, AccessControl } from '@types/index';

export interface UploadVideoParams {
  title: string;
  description?: string;
  tags?: string[];
  category?: string;
  accessControl?: Partial<AccessControl> & { organization?: string };
}

export interface GetVideosParams {
  page?: number;
  limit?: number;
  status?: VideoStatus;
  category?: string;
  classification?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface GetVideosResponse {
  videos: Video[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ReviewVideoParams {
  approved: boolean;
  notes?: string;
}

class VideoService {
  /**
   * Upload a video file with metadata
   */
  async uploadVideo(
    file: File,
    metadata: UploadVideoParams,
    onProgress?: (progress: number) => void
  ): Promise<Video> {
    const formData = new FormData();
    formData.append('video', file);
    formData.append('title', metadata.title);

    if (metadata.description) {
      formData.append('description', metadata.description);
    }

    if (metadata.tags && metadata.tags.length > 0) {
      formData.append('tags', JSON.stringify(metadata.tags));
    }

    if (metadata.category) {
      formData.append('category', metadata.category);
    }

    if (metadata.accessControl) {
      formData.append('accessControl', JSON.stringify(metadata.accessControl));
    }

    return apiService.uploadFile<Video>('/videos/upload', formData, onProgress);
  }

  /**
   * Get list of videos with filters and pagination
   */
  async getVideos(params?: GetVideosParams): Promise<GetVideosResponse> {
    return apiService.get<GetVideosResponse>('/videos', params);
  }

  /**
   * Get a single video by ID
   */
  async getVideoById(videoId: string): Promise<Video> {
    // Backend returns shape: { video: Video }
    const res = await apiService.get<{ video: any }>(`/videos/${videoId}`);
    const v = res.video;
    // Ensure `id` exists (backend may return `_id`)
    if (v && !v.id && v._id) {
      v.id = v._id;
    }
    return v as Video;
  }

  /**
   * Update video metadata
   */
  async updateVideo(videoId: string, updates: Partial<Video>): Promise<Video> {
    return apiService.patch<Video>(`/videos/${videoId}`, updates);
  }

  /**
   * Delete a video
   */
  async deleteVideo(videoId: string): Promise<void> {
    return apiService.delete<void>(`/videos/${videoId}`);
  }

  /**
   * Get streaming URLs (HLS/DASH/MP4) for a video
   */
  async getStreamingUrl(videoId: string): Promise<{
    hlsUrl: string | null;
    mp4Url?: string | null;
    dashUrl?: string | null;
    mp4Urls?: Record<string, string> | null;
    thumbnailUrl?: string | null;
    posterUrl?: string | null;
    qualities?: Array<{ resolution: string; bitrate: string; url: string }>;
    fallbackToMp4?: boolean;
    directStreamUrl?: string;
  }> {
    return apiService.get<{
      hlsUrl: string | null;
      mp4Url?: string | null;
      dashUrl?: string | null;
      mp4Urls?: Record<string, string> | null;
      thumbnailUrl?: string | null;
      posterUrl?: string | null;
      qualities?: Array<{ resolution: string; bitrate: string; url: string }>;
      fallbackToMp4?: boolean;
      directStreamUrl?: string;
    }>(`/streaming/${videoId}`);
  }

  /**
   * Review a flagged video (Admin/Moderator only)
   */
  async reviewVideo(videoId: string, params: ReviewVideoParams): Promise<Video> {
    return apiService.post<Video>(`/videos/${videoId}/review`, params);
  }

  /**
   * Increment view count
   */
  async incrementViews(videoId: string): Promise<void> {
    return apiService.post<void>(`/videos/${videoId}/view`);
  }

  /**
   * Get video analytics (Admin only)
   */
  async getVideoAnalytics(videoId: string): Promise<any> {
    return apiService.get<any>(`/analytics/videos/${videoId}`);
  }
}

export default new VideoService();
