import { create } from 'zustand';

interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  timestamp: Date;
  read: boolean;
}

interface SocketState {
  isConnected: boolean;
  notifications: Notification[];
  lastMessage: any | null;

  // Actions
  setConnected: (connected: boolean) => void;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markNotificationRead: (notificationId: string) => void;
  markAllNotificationsRead: () => void;
  removeNotification: (notificationId: string) => void;
  clearNotifications: () => void;
  setLastMessage: (message: any) => void;
}

const MAX_NOTIFICATIONS = 10;

export const useSocketStore = create<SocketState>((set) => ({
  isConnected: false,
  notifications: [],
  lastMessage: null,

  setConnected: (connected) => {
    set({ isConnected: connected });
  },

  addNotification: (notification) => {
    set((state) => {
      const newNotification: Notification = {
        ...notification,
        id: `${Date.now()}-${Math.random()}`,
        timestamp: new Date(),
        read: false,
      };

      // Keep only the latest MAX_NOTIFICATIONS
      const notifications = [newNotification, ...state.notifications].slice(
        0,
        MAX_NOTIFICATIONS
      );

      return { notifications };
    });
  },

  markNotificationRead: (notificationId) => {
    set((state) => ({
      notifications: state.notifications.map((notif) =>
        notif.id === notificationId ? { ...notif, read: true } : notif
      ),
    }));
  },

  markAllNotificationsRead: () => {
    set((state) => ({
      notifications: state.notifications.map((notif) => ({
        ...notif,
        read: true,
      })),
    }));
  },

  removeNotification: (notificationId) => {
    set((state) => ({
      notifications: state.notifications.filter(
        (notif) => notif.id !== notificationId
      ),
    }));
  },

  clearNotifications: () => {
    set({ notifications: [] });
  },

  setLastMessage: (message) => {
    set({ lastMessage: message });
  },
}));
