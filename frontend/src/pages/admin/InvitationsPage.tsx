import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Plus, Search, RefreshCw, X, Clock, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import { Button } from '@components/ui/button';
import { Badge } from '@components/ui/badge';
import adminService from '@services/admin.service';
import { CreateInvitationDialog } from '@components/admin/CreateInvitationDialog';

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  tenant: {
    id: string;
    name: string;
  };
  invitedBy: {
    id: string;
    username: string;
    email: string;
  };
  expiresAt: string;
  createdAt: string;
}

export const InvitationsPage = () => {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  useEffect(() => {
    loadInvitations();
  }, []);

  const loadInvitations = async () => {
    try {
      setIsLoading(true);
      const { invitations: allInvitations } = await adminService.getAllInvitations({ page: 1, limit: 100 });
      setInvitations(allInvitations);
    } catch (error) {
      console.error('Failed to load invitations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async (invitationId: string) => {
    try {
      await adminService.resendInvitation(invitationId);
      alert('Invitation resent successfully');
      loadInvitations();
    } catch (error) {
      alert('Failed to resend invitation');
      console.error(error);
    }
  };

  const handleCancel = async (invitationId: string) => {
    if (!confirm('Are you sure you want to cancel this invitation?')) return;

    try {
      await adminService.cancelInvitation(invitationId);
      loadInvitations();
    } catch (error) {
      alert('Failed to cancel invitation');
      console.error(error);
    }
  };

  const filteredInvitations = invitations.filter(invitation => {
    const matchesSearch = invitation.email.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || invitation.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'accepted': return <CheckCircle className="w-4 h-4" />;
      case 'expired': return <XCircle className="w-4 h-4" />;
      case 'cancelled': return <X className="w-4 h-4" />;
      default: return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500';
      case 'accepted': return 'bg-green-500';
      case 'expired': return 'bg-gray-500';
      case 'cancelled': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-500';
      case 'editor': return 'bg-yellow-500';
      case 'viewer': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const isExpiringSoon = (expiresAt: string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const hoursUntilExpiry = (expires.getTime() - now.getTime()) / (1000 * 60 * 60);
    return hoursUntilExpiry > 0 && hoursUntilExpiry < 24;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading invitations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-7xl mx-auto p-6 space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center">
              <Mail className="w-8 h-8 mr-3" />
              Invitations
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage user invitations across organizations
            </p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Send Invitation
          </Button>
        </div>

        {/* Search and Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border rounded-lg"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="accepted">Accepted</option>
                <option value="expired">Expired</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Invitations List */}
        <div className="grid grid-cols-1 gap-4">
          {filteredInvitations.map((invitation) => (
            <motion.div key={invitation.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-3">
                        {invitation.email}
                        <Badge className={getStatusColor(invitation.status)}>
                          {getStatusIcon(invitation.status)}
                          <span className="ml-1">{invitation.status}</span>
                        </Badge>
                        <Badge className={getRoleBadgeColor(invitation.role)}>
                          {invitation.role}
                        </Badge>
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        Organization: {invitation.tenant.name}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {invitation.status === 'pending' && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleResend(invitation.id)}
                          >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Resend
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCancel(invitation.id)}
                          >
                            <X className="w-4 h-4 text-red-500" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-6 text-sm">
                    <div>
                      <span className="text-muted-foreground">Invited by: </span>
                      <span>{invitation.invitedBy.username}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Created: </span>
                      <span>{new Date(invitation.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Expires: </span>
                      <span className={isExpiringSoon(invitation.expiresAt) ? 'text-yellow-600 font-semibold' : ''}>
                        {new Date(invitation.expiresAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  {isExpiringSoon(invitation.expiresAt) && invitation.status === 'pending' && (
                    <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                      ⚠️ This invitation expires in less than 24 hours
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {filteredInvitations.length === 0 && (
          <Card className="p-12 text-center">
            <Mail className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No invitations found</p>
          </Card>
        )}
      </motion.div>

      <CreateInvitationDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onSuccess={loadInvitations}
      />
    </div>
  );
};
