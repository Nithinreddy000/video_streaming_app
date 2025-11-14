import { useState } from 'react';
import videoService, { type UploadVideoParams } from '@services/video.service';
import { useVideoStore } from '@store/videoStore';
import socketService from '@services/socket.service';
import type { Video } from '@types/index';

const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB
const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/mpeg',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
  'video/webm',
];

export interface UploadError {
  message: string;
  code?: string;
}

export const useVideoUpload = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<UploadError | null>(null);
  const [uploadedVideo, setUploadedVideo] = useState<Video | null>(null);

  const { addVideo, setUploadProgress: setStoreProgress, removeUploadProgress } = useVideoStore();

  /**
   * Validate file before upload
   */
  const validateFile = (file: File): UploadError | null => {
    // Check file type
    if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
      return {
        message: 'Invalid file type. Please upload a valid video file (MP4, MOV, AVI, MKV, WEBM).',
        code: 'INVALID_FILE_TYPE',
      };
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return {
        message: `File size exceeds the maximum limit of ${MAX_FILE_SIZE / (1024 * 1024 * 1024)}GB.`,
        code: 'FILE_TOO_LARGE',
      };
    }

    return null;
  };

  /**
   * Upload video file with metadata
   */
  const uploadVideo = async (file: File, metadata: UploadVideoParams): Promise<Video | null> => {
    // Reset state
    setError(null);
    setUploadProgress(0);
    setUploadedVideo(null);

    // Validate file
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return null;
    }

    setIsUploading(true);

    try {
      const fileId = `${Date.now()}-${file.name}`;

      // Upload with progress tracking
      const video = await videoService.uploadVideo(file, metadata, (progress) => {
        setUploadProgress(progress);
        setStoreProgress(fileId, progress);
      });

      // Success
      setUploadedVideo(video);
      addVideo(video);
      removeUploadProgress(fileId);

      // Join socket room to receive processing progress updates
      console.log('Joining socket room for video:', video.id);
      socketService.joinVideoRoom(video.id);

      return video;
    } catch (err: any) {
      const uploadError: UploadError = {
        message: err.response?.data?.message || 'Failed to upload video. Please try again.',
        code: err.response?.data?.code || 'UPLOAD_FAILED',
      };
      setError(uploadError);
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  /**
   * Reset upload state
   */
  const reset = () => {
    setIsUploading(false);
    setUploadProgress(0);
    setError(null);
    setUploadedVideo(null);
  };

  return {
    uploadVideo,
    isUploading,
    uploadProgress,
    error,
    uploadedVideo,
    reset,
    validateFile,
  };
};
