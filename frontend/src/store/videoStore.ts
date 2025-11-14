import { create } from 'zustand';
import type { Video } from '@types/index';
import videoService from '@services/video.service';

interface VideoFilters {
  status?: string;
  category?: string;
  classification?: string;
  search?: string;
  tags?: string[];
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface VideoState {
  videos: Video[];
  currentVideo: Video | null;
  filters: VideoFilters;
  pagination: Pagination;
  uploadProgress: Map<string, number>;
  isLoading: boolean;
  error: string | null;

  // Actions
  setVideos: (videos: Video[]) => void;
  addVideo: (video: Video) => void;
  updateVideo: (videoId: string, updates: Partial<Video>) => void;
  removeVideo: (videoId: string) => void;
  setCurrentVideo: (video: Video | null) => void;
  setFilters: (filters: Partial<VideoFilters>) => void;
  clearFilters: () => void;
  setPagination: (pagination: Partial<Pagination>) => void;
  setUploadProgress: (fileId: string, progress: number) => void;
  removeUploadProgress: (fileId: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  fetchVideos: (options?: { page?: number; limit?: number }) => Promise<void>;
}

export const useVideoStore = create<VideoState>((set) => ({
  videos: [],
  currentVideo: null,
  filters: {},
  pagination: {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  },
  uploadProgress: new Map(),
  isLoading: false,
  error: null,

  setVideos: (videos) => {
    set({ videos, isLoading: false, error: null });
  },

  addVideo: (video) => {
    set((state) => ({
      videos: [video, ...state.videos],
      error: null,
    }));
  },

  updateVideo: (videoId, updates) => {
    set((state) => ({
      videos: state.videos.map((video) =>
        (video.id === videoId || video._id?.toString() === videoId)
          ? { ...video, ...updates }
          : video
      ),
      currentVideo:
        (state.currentVideo?.id === videoId || state.currentVideo?._id?.toString() === videoId)
          ? { ...state.currentVideo, ...updates }
          : state.currentVideo,
    }));
  },

  removeVideo: (videoId) => {
    set((state) => ({
      videos: state.videos.filter((video) => video.id !== videoId),
      currentVideo:
        state.currentVideo?.id === videoId ? null : state.currentVideo,
    }));
  },

  setCurrentVideo: (video) => {
    set({ currentVideo: video });
  },

  setFilters: (filters) => {
    set((state) => ({
      filters: { ...state.filters, ...filters },
      pagination: { ...state.pagination, page: 1 }, // Reset to first page when filters change
    }));
  },

  clearFilters: () => {
    set({
      filters: {},
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
  },

  setPagination: (pagination) => {
    set((state) => ({
      pagination: { ...state.pagination, ...pagination },
    }));
  },

  setUploadProgress: (fileId, progress) => {
    set((state) => {
      const newProgress = new Map(state.uploadProgress);
      newProgress.set(fileId, progress);
      return { uploadProgress: newProgress };
    });
  },

  removeUploadProgress: (fileId) => {
    set((state) => {
      const newProgress = new Map(state.uploadProgress);
      newProgress.delete(fileId);
      return { uploadProgress: newProgress };
    });
  },

  setLoading: (loading) => {
    set({ isLoading: loading });
  },

  setError: (error) => {
    set({ error, isLoading: false });
  },

  fetchVideos: async (options = {}) => {
    const { page = 1, limit = 20 } = options;
    set({ isLoading: true, error: null });

    try {
      // Fetch videos from backend API
      const response = await videoService.getVideos({ page, limit });

      set({
        videos: response.videos || [],
        pagination: response.pagination || {
          page,
          limit,
          total: 0,
          totalPages: 0,
        },
        isLoading: false,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch videos';
      set({ error: errorMessage, isLoading: false });
    }
  },
}));
