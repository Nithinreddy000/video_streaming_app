import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Tenant, AuthTokens } from '@types/index';
import { STORAGE_KEYS } from '@utils/constants';

interface AuthState {
  user: User | null;
  tenant: Tenant | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  login: (user: User, tenant: Tenant, tokens: AuthTokens) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
  updateTokens: (tokens: AuthTokens) => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      tenant: null,
      tokens: null,
      isAuthenticated: false,
      isLoading: false,

      login: (user, tenant, tokens) => {
        // Save to Zustand state (will be persisted by middleware)
        set({
          user,
          tenant,
          tokens,
          isAuthenticated: true,
          isLoading: false,
        });

        // Also save tokens to individual localStorage keys for API and Socket services
        localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, tokens.accessToken);
        localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, tokens.refreshToken);
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
      },

      logout: () => {
        // Clear Zustand state
        set({
          user: null,
          tenant: null,
          tokens: null,
          isAuthenticated: false,
          isLoading: false,
        });

        // Also clear individual localStorage keys
        localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
        localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
        localStorage.removeItem(STORAGE_KEYS.USER);
      },

      updateUser: (updatedUser) => {
        set((state) => ({
          user: state.user ? { ...state.user, ...updatedUser } : null,
        }));
      },

      updateTokens: (tokens) => {
        // Update Zustand state
        set({ tokens });

        // Also update individual localStorage keys
        localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, tokens.accessToken);
        localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, tokens.refreshToken);
      },

      setLoading: (loading) => {
        set({ isLoading: loading });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        tenant: state.tenant,
        tokens: state.tokens,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
