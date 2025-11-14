import apiService from './api.service';
import type { User, Tenant } from '@types/index';

// Admin User Management
export interface CreateUserParams {
  username: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  role: 'viewer' | 'editor' | 'admin';
  tenantId: string;
}

export interface UpdateUserParams {
  username?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: 'viewer' | 'editor' | 'admin';
  isActive?: boolean;
}

export interface SystemStats {
  tenants: {
    total: number;
    active: number;
    inactive: number;
    byPlan: Record<string, number>;
  };
  users: {
    total: number;
    active: number;
    inactive: number;
    byRole: Record<string, number>;
  };
  storage: {
    totalUsedGB: number;
    totalLimitGB: number;
    totalVideos: number;
    totalStreams: number;
  };
}

class AdminService {
  // ============ User Management ============

  async getAllUsers(params?: {
    page?: number;
    limit?: number;
    tenantId?: string;
    role?: string;
    isActive?: boolean;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ users: User[]; pagination: any }> {
    return apiService.get('/admin/users', params);
  }

  async getUserById(userId: string): Promise<{ user: User }> {
    return apiService.get(`/admin/users/${userId}`);
  }

  async createUser(userData: CreateUserParams): Promise<{ message: string; user: User }> {
    return apiService.post('/admin/users', userData);
  }

  async updateUser(userId: string, updates: UpdateUserParams): Promise<{ message: string; user: User }> {
    return apiService.put(`/admin/users/${userId}`, updates);
  }

  async deactivateUser(userId: string): Promise<{ message: string }> {
    return apiService.delete(`/admin/users/${userId}`);
  }

  async changeUserRole(userId: string, role: 'viewer' | 'editor' | 'admin'): Promise<{ message: string; user: User }> {
    return apiService.put(`/admin/users/${userId}/role`, { role });
  }

  async moveUserToTenant(userId: string, tenantId: string): Promise<{ message: string; user: User }> {
    return apiService.put(`/admin/users/${userId}/tenant`, { tenantId });
  }

  // ============ Tenant/Organization Management ============

  async getAllTenants(params?: {
    page?: number;
    limit?: number;
    isActive?: boolean;
    subscriptionStatus?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ tenants: Tenant[]; pagination: any }> {
    return apiService.get('/tenants', params);
  }

  async getTenantById(tenantId: string): Promise<{ tenant: Tenant }> {
    return apiService.get(`/tenants/${tenantId}`);
  }

  async createTenant(tenantData: {
    name: string;
    slug?: string;
    description?: string;
    settings?: any;
    subscription?: any;
    contactInfo?: any;
  }): Promise<{ message: string; tenant: Tenant }> {
    return apiService.post('/tenants', tenantData);
  }

  async updateTenant(tenantId: string, updates: any): Promise<{ message: string; tenant: Tenant }> {
    return apiService.put(`/tenants/${tenantId}`, updates);
  }

  async deactivateTenant(tenantId: string, force?: boolean): Promise<{ message: string; tenant: Tenant }> {
    const params = force ? { force: 'true' } : {};
    return apiService.delete(`/tenants/${tenantId}?${new URLSearchParams(params)}`);
  }

  async getTenantUsers(tenantId: string, params?: {
    page?: number;
    limit?: number;
    role?: string;
    isActive?: boolean;
  }): Promise<{ users: User[]; tenant: any; pagination: any }> {
    return apiService.get(`/tenants/${tenantId}/users`, params);
  }

  async getTenantStats(tenantId: string): Promise<{ stats: any }> {
    return apiService.get(`/tenants/${tenantId}/stats`);
  }

  // ============ Invitation Management ============

  async createInvitation(invitationData: {
    email: string;
    tenantId: string;
    role: 'viewer' | 'editor' | 'admin';
  }): Promise<{ message: string; invitation: any }> {
    return apiService.post('/admin/invitations', invitationData);
  }

  async getAllInvitations(params?: {
    page?: number;
    limit?: number;
    tenantId?: string;
    status?: string;
    email?: string;
  }): Promise<{ invitations: any[]; pagination: any }> {
    return apiService.get('/admin/invitations', params);
  }

  async getInvitationById(invitationId: string): Promise<{ invitation: any }> {
    return apiService.get(`/admin/invitations/${invitationId}`);
  }

  async resendInvitation(invitationId: string): Promise<{ message: string; invitation: any }> {
    return apiService.post(`/admin/invitations/${invitationId}/resend`, {});
  }

  async cancelInvitation(invitationId: string): Promise<{ message: string }> {
    return apiService.delete(`/admin/invitations/${invitationId}`);
  }

  // ============ System Stats ============

  async getSystemStats(): Promise<{ stats: SystemStats }> {
    return apiService.get('/admin/stats');
  }
}

export default new AdminService();
