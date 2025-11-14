import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark' | 'system';

interface ModalState {
  isOpen: boolean;
  data?: any;
}

interface UIState {
  theme: Theme;
  sidebarCollapsed: boolean;
  modals: {
    videoUpload: ModalState;
    videoDetail: ModalState;
    videoEdit: ModalState;
    videoDelete: ModalState;
    userProfile: ModalState;
  };
  loadingStates: Map<string, boolean>;

  // Actions
  setTheme: (theme: Theme) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  openModal: (modalName: keyof UIState['modals'], data?: any) => void;
  closeModal: (modalName: keyof UIState['modals']) => void;
  setLoading: (key: string, loading: boolean) => void;
  isLoading: (key: string) => boolean;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      theme: 'system',
      sidebarCollapsed: false,
      modals: {
        videoUpload: { isOpen: false },
        videoDetail: { isOpen: false },
        videoEdit: { isOpen: false },
        videoDelete: { isOpen: false },
        userProfile: { isOpen: false },
      },
      loadingStates: new Map(),

      setTheme: (theme) => {
        set({ theme });

        // Apply theme to document
        const root = window.document.documentElement;
        root.classList.remove('light', 'dark');

        if (theme === 'system') {
          const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
            .matches
            ? 'dark'
            : 'light';
          root.classList.add(systemTheme);
        } else {
          root.classList.add(theme);
        }
      },

      toggleSidebar: () => {
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
      },

      setSidebarCollapsed: (collapsed) => {
        set({ sidebarCollapsed: collapsed });
      },

      openModal: (modalName, data) => {
        set((state) => ({
          modals: {
            ...state.modals,
            [modalName]: { isOpen: true, data },
          },
        }));
      },

      closeModal: (modalName) => {
        set((state) => ({
          modals: {
            ...state.modals,
            [modalName]: { isOpen: false, data: undefined },
          },
        }));
      },

      setLoading: (key, loading) => {
        set((state) => {
          const newLoadingStates = new Map(state.loadingStates);
          if (loading) {
            newLoadingStates.set(key, true);
          } else {
            newLoadingStates.delete(key);
          }
          return { loadingStates: newLoadingStates };
        });
      },

      isLoading: (key) => {
        return get().loadingStates.get(key) || false;
      },
    }),
    {
      name: 'ui-storage',
      partialize: (state) => ({
        theme: state.theme,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    }
  )
);
