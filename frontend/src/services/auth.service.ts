import apiService from './api.service';
import type { User, Tenant, AuthTokens, AuthResponse } from '@types/index';

export interface LoginParams {
  email: string;
  password: string;
}

export interface RegisterParams {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  organizationName: string;
  subdomain: string;
}

export interface RefreshTokenParams {
  refreshToken: string;
}

class AuthService {
  /**
   * User login
   */
  async login(params: LoginParams): Promise<AuthResponse> {
    return apiService.post<AuthResponse>('/auth/login', params);
  }

  /**
   * User registration (creates user + tenant)
   */
  async register(params: RegisterParams): Promise<AuthResponse> {
    return apiService.post<AuthResponse>('/auth/register', params);
  }

  /**
   * User logout
   */
  async logout(): Promise<void> {
    return apiService.post<void>('/auth/logout');
  }

  /**
   * Refresh access token
   */
  async refreshToken(params: RefreshTokenParams): Promise<{ accessToken: string }> {
    return apiService.post<{ accessToken: string }>('/auth/refresh', params);
  }

  /**
   * Get current authenticated user
   */
  async getCurrentUser(): Promise<{ user: User; tenant: Tenant }> {
    return apiService.get<{ user: User; tenant: Tenant }>('/auth/me');
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<{ message: string }> {
    return apiService.post<{ message: string }>('/auth/forgot-password', { email });
  }

  /**
   * Reset password with token
   */
  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    return apiService.post<{ message: string }>('/auth/reset-password', {
      token,
      newPassword,
    });
  }

  /**
   * Change password (authenticated user)
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
    return apiService.post<{ message: string }>('/auth/change-password', {
      currentPassword,
      newPassword,
    });
  }

  /**
   * Update user profile
   */
  async updateProfile(updates: Partial<User>): Promise<User> {
    return apiService.patch<User>('/auth/profile', updates);
  }
}

export default new AuthService();
