import apiService from './api.service';
import adminService from './admin.service';

class InvitationService {
  /**
   * Verify invitation token (public endpoint)
   */
  async verifyInvitation(token: string): Promise<{
    message: string;
    invitation: {
      email: string;
      role: string;
      tenant: any;
      expiresAt: string;
    };
  }> {
    return apiService.get(`/invitations/verify/${token}`);
  }

  /**
   * Accept invitation and register (public endpoint)
   */
  async acceptInvitation(token: string, userData: {
    username: string;
    password: string;
    firstName?: string;
    lastName?: string;
  }): Promise<{
    message: string;
    user: any;
    tokens: {
      accessToken: string;
      refreshToken: string;
    };
  }> {
    return apiService.post(`/invitations/accept/${token}`, userData);
  }

  // ============ Admin Methods ============

  /**
   * Get all invitations (admin)
   */
  async getAllInvitations(params?: {
    page?: number;
    limit?: number;
    tenantId?: string;
    status?: string;
    email?: string;
  }) {
    return adminService.getAllInvitations(params);
  }

  /**
   * Get invitation by ID (admin)
   */
  async getInvitationById(invitationId: string) {
    return adminService.getInvitationById(invitationId);
  }

  /**
   * Create invitation (admin)
   */
  async createInvitation(invitationData: {
    email: string;
    tenantId: string;
    role: 'viewer' | 'editor' | 'admin';
  }) {
    return adminService.createInvitation(invitationData);
  }

  /**
   * Resend invitation (admin)
   */
  async resendInvitation(invitationId: string) {
    return adminService.resendInvitation(invitationId);
  }

  /**
   * Revoke/cancel invitation (admin)
   */
  async revokeInvitation(invitationId: string) {
    return adminService.cancelInvitation(invitationId);
  }
}

export default new InvitationService();
