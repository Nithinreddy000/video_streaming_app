import { io, Socket } from 'socket.io-client';
import { SOCKET_URL, STORAGE_KEYS } from '@utils/constants';
import { useSocketStore } from '@store/socketStore';
import { useVideoStore } from '@store/videoStore';

class SocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  /**
   * Initialize Socket.IO connection
   */
  async connect(): Promise<void> {
    if (this.socket?.connected) {
      console.log('Socket already connected');
      return;
    }

    const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    if (!token) {
      console.warn('No access token found, cannot connect to socket');

      // Clear authentication state if token is missing
      try {
        const { useAuthStore } = await import('@store/authStore');
        useAuthStore.getState().logout();
      } catch (error) {
        console.error('Failed to clear auth state:', error);
      }

      return;
    }

    this.socket = io(SOCKET_URL, {
      auth: {
        token,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: this.maxReconnectAttempts,
    });

    this.setupEventListeners();
  }

  /**
   * Disconnect from Socket.IO
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      useSocketStore.getState().setConnected(false);
    }
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket?.id);
      useSocketStore.getState().setConnected(true);
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      useSocketStore.getState().setConnected(false);
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      this.reconnectAttempts++;

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        useSocketStore.getState().addNotification({
          type: 'error',
          message: 'Failed to connect to real-time updates. Please refresh the page.',
        });
      }
    });

    // Video processing events
    this.socket.on('processing-progress', (data: { videoId: string; progress: number; stage: string }) => {
      console.log('Processing progress:', data);
      useVideoStore.getState().updateVideo(data.videoId, {
        processingProgress: data.progress,
      });

      useSocketStore.getState().setLastMessage(data);
    });

    this.socket.on('processing-complete', (data: { videoId: string; video: any }) => {
      console.log('Processing complete:', data);

      // Ensure status is explicitly set to 'ready' and progress to 100
      useVideoStore.getState().updateVideo(data.videoId, {
        ...data.video,
        status: 'ready' as any,
        processingProgress: 100,
      });

      useSocketStore.getState().addNotification({
        type: 'success',
        message: `Video "${data.video.title || 'Video'}" is ready to watch!`,
      });
    });

    this.socket.on('processing-error', (data: { videoId: string; error: string }) => {
      console.error('Processing error:', data);
      useVideoStore.getState().updateVideo(data.videoId, {
        status: 'failed' as any,
      });

      useSocketStore.getState().addNotification({
        type: 'error',
        message: `Video processing failed: ${data.error}`,
      });
    });

    // AI analysis events
    this.socket.on('ai-analysis-complete', (data: { videoId: string; analysis: any }) => {
      console.log('AI analysis complete:', data);
      useVideoStore.getState().updateVideo(data.videoId, {
        aiAnalysis: data.analysis,
      });

      if (data.analysis.status === 'flagged') {
        useSocketStore.getState().addNotification({
          type: 'warning',
          message: 'Video flagged for review by AI moderation.',
        });
      }
    });

    // Video state event (sent when joining a room to catch up on current state)
    this.socket.on('video-state', (data: { videoId: string; status: string; processingProgress?: number; aiAnalysis?: any }) => {
      console.log('Video state received:', data);
      useVideoStore.getState().updateVideo(data.videoId, {
        status: data.status as any,
        processingProgress: data.processingProgress,
        aiAnalysis: data.aiAnalysis,
      });
    });

    // Generic notification event
    this.socket.on('notification', (data: { type: string; message: string }) => {
      useSocketStore.getState().addNotification({
        type: data.type as any,
        message: data.message,
      });
    });
  }

  /**
   * Join a video-specific room for updates
   */
  joinVideoRoom(videoId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('join-video-room', { videoId });
    }
  }

  /**
   * Leave a video-specific room
   */
  leaveVideoRoom(videoId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('leave-video-room', { videoId });
    }
  }

  /**
   * Join tenant room (auto-joined on connection)
   */
  joinTenantRoom(tenantId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('join-tenant-room', { tenantId });
    }
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  /**
   * Get socket instance for custom events
   */
  getSocket(): Socket | null {
    return this.socket;
  }
}

export default new SocketService();
