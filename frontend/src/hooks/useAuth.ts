import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import authService, { type LoginParams, type RegisterParams } from '@services/auth.service';
import socketService from '@services/socket.service';
import { useAuthStore } from '@store/authStore';
import { STORAGE_KEYS, ROUTES } from '@utils/constants';

export const useAuth = () => {
  const navigate = useNavigate();
  const {
    user,
    tenant,
    isAuthenticated,
    isLoading,
    login: setAuthState,
    logout: clearAuthState,
    setLoading,
  } = useAuthStore();

  const [error, setError] = useState<string | null>(null);

  /**
   * Login user
   */
  const login = useCallback(
    async (params: LoginParams) => {
      setLoading(true);
      setError(null);

      try {
        const response = await authService.login(params);

        // Store tokens
        localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, response.tokens.accessToken);
        localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, response.tokens.refreshToken);
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(response.user));

        // Update auth state
        setAuthState(response.user, response.tenant, response.tokens);

        // Connect to Socket.IO
        socketService.connect();

        // Navigate to dashboard
        navigate(ROUTES.DASHBOARD);

        return true;
      } catch (err: any) {
        const errorMessage = err.response?.data?.message || 'Login failed. Please try again.';
        setError(errorMessage);
        setLoading(false);
        return false;
      }
    },
    [setAuthState, setLoading, navigate]
  );

  /**
   * Register new user and tenant
   */
  const register = useCallback(
    async (params: RegisterParams) => {
      setLoading(true);
      setError(null);

      try {
        const response = await authService.register(params);

        // Store tokens
        localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, response.tokens.accessToken);
        localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, response.tokens.refreshToken);
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(response.user));

        // Update auth state
        setAuthState(response.user, response.tenant, response.tokens);

        // Connect to Socket.IO
        socketService.connect();

        // Navigate to dashboard
        navigate(ROUTES.DASHBOARD);

        return true;
      } catch (err: any) {
        const errorMessage = err.response?.data?.message || 'Registration failed. Please try again.';
        setError(errorMessage);
        setLoading(false);
        return false;
      }
    },
    [setAuthState, setLoading, navigate]
  );

  /**
   * Logout user
   */
  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      // Clear local storage
      localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.USER);

      // Clear auth state
      clearAuthState();

      // Disconnect socket
      socketService.disconnect();

      // Navigate to login
      navigate(ROUTES.LOGIN);
    }
  }, [clearAuthState, navigate]);

  /**
   * Check if user has specific role
   */
  const hasRole = useCallback(
    (role: string): boolean => {
      return user?.role === role;
    },
    [user]
  );

  /**
   * Check if user is admin
   */
  const isAdmin = useCallback((): boolean => {
    return user?.role === 'admin';
  }, [user]);

  /**
   * Check if user is editor or admin
   */
  const canEdit = useCallback((): boolean => {
    return user?.role === 'admin' || user?.role === 'editor';
  }, [user]);

  /**
   * Refresh user data
   */
  const refreshUser = useCallback(async () => {
    try {
      const response = await authService.getCurrentUser();
      setAuthState(response.user, response.tenant, useAuthStore.getState().tokens!);
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(response.user));
    } catch (err) {
      console.error('Failed to refresh user:', err);
    }
  }, [setAuthState]);

  return {
    user,
    tenant,
    isAuthenticated,
    isLoading,
    error,
    login,
    register,
    logout,
    hasRole,
    isAdmin,
    canEdit,
    refreshUser,
  };
};
