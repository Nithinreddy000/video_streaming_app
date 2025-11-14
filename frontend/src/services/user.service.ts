import adminService from './admin.service';

class UserService {
  /**
   * Get all users
   */
  async getAllUsers(params?: {
    page?: number;
    limit?: number;
    tenantId?: string;
    role?: string;
    isActive?: boolean;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    return adminService.getAllUsers(params);
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string) {
    return adminService.getUserById(userId);
  }

  /**
   * Create new user
   */
  async createUser(userData: {
    username: string;
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    role: 'viewer' | 'editor' | 'admin';
    tenantId: string;
  }) {
    return adminService.createUser(userData);
  }

  /**
   * Update user
   */
  async updateUser(userId: string, updates: {
    username?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    role?: 'viewer' | 'editor' | 'admin';
    isActive?: boolean;
  }) {
    return adminService.updateUser(userId, updates);
  }

  /**
   * Deactivate user
   */
  async deactivateUser(userId: string) {
    return adminService.deactivateUser(userId);
  }

  /**
   * Change user role
   */
  async changeUserRole(userId: string, role: 'viewer' | 'editor' | 'admin') {
    return adminService.changeUserRole(userId, role);
  }

  /**
   * Move user to different tenant/organization
   */
  async moveUserToTenant(userId: string, tenantId: string) {
    return adminService.moveUserToTenant(userId, tenantId);
  }
}

export default new UserService();
