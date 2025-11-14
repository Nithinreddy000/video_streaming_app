import adminService from './admin.service';

class OrganizationService {
  /**
   * Get all organizations (tenants)
   */
  async getAllOrganizations(params?: {
    page?: number;
    limit?: number;
    isActive?: boolean;
    subscriptionStatus?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    return adminService.getAllTenants(params);
  }

  /**
   * Get organization by ID
   */
  async getOrganizationById(organizationId: string) {
    return adminService.getTenantById(organizationId);
  }

  /**
   * Create new organization
   */
  async createOrganization(organizationData: {
    name: string;
    slug?: string;
    description?: string;
    settings?: any;
    subscription?: any;
    contactInfo?: any;
  }) {
    return adminService.createTenant(organizationData);
  }

  /**
   * Update organization
   */
  async updateOrganization(organizationId: string, updates: any) {
    return adminService.updateTenant(organizationId, updates);
  }

  /**
   * Deactivate organization
   */
  async deactivateOrganization(organizationId: string, force?: boolean) {
    return adminService.deactivateTenant(organizationId, force);
  }

  /**
   * Get organization users
   */
  async getOrganizationUsers(organizationId: string, params?: {
    page?: number;
    limit?: number;
    role?: string;
    isActive?: boolean;
  }) {
    return adminService.getTenantUsers(organizationId, params);
  }

  /**
   * Get organization statistics
   */
  async getOrganizationStats(organizationId: string) {
    return adminService.getTenantStats(organizationId);
  }
}

export default new OrganizationService();
