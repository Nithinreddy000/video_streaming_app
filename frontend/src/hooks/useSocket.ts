import { useEffect, useRef, useCallback } from 'react';
import socketService from '@services/socket.service';
import { useAuthStore } from '@store/authStore';
import { useSocketStore } from '@store/socketStore';
import { STORAGE_KEYS } from '@utils/constants';

export const useSocket = () => {
  const { isAuthenticated } = useAuthStore();
  const { isConnected } = useSocketStore();
  const connectionAttempted = useRef(false);

  useEffect(() => {
    // Auto-connect when user is authenticated AND token exists
    if (isAuthenticated && !connectionAttempted.current) {
      // Verify token actually exists in localStorage
      const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);

      if (token) {
        connectionAttempted.current = true;
        socketService.connect();
      } else {
        // Token missing but auth state says authenticated - clear auth state
        console.warn('Token missing but auth state is true, logging out...');
        useAuthStore.getState().logout();
      }
    }

    // Disconnect when user logs out
    if (!isAuthenticated && connectionAttempted.current) {
      connectionAttempted.current = false;
      socketService.disconnect();
    }

    // Cleanup on unmount
    return () => {
      if (!isAuthenticated) {
        socketService.disconnect();
      }
    };
  }, [isAuthenticated]);

  /**
   * Join a video-specific room for real-time updates
   */
  const joinVideoRoom = useCallback((videoId: string) => {
    socketService.joinVideoRoom(videoId);
  }, []);

  /**
   * Leave a video-specific room
   */
  const leaveVideoRoom = useCallback((videoId: string) => {
    socketService.leaveVideoRoom(videoId);
  }, []);

  /**
   * Get socket instance for custom events
   */
  const getSocket = useCallback(() => {
    return socketService.getSocket();
  }, []);

  return {
    isConnected,
    joinVideoRoom,
    leaveVideoRoom,
    getSocket,
  };
};
