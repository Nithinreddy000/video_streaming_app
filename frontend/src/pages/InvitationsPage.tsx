import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Plus, Search, Loader2, RefreshCw, XCircle, Clock, CheckCircle, ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Badge } from '@components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@components/ui/table';
import { CreateInvitationDialog } from '@components/admin/CreateInvitationDialog';
import invitationService from '@services/invitation.service';
import organizationService from '@services/organization.service';
import { useToast } from '@hooks/use-toast';
import { ROUTES } from '@utils/constants';

export const InvitationsPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [invitations, setInvitations] = useState<any[]>([]);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [invitationsData, orgsData] = await Promise.all([
        invitationService.getAllInvitations(),
        organizationService.getAllOrganizations(),
      ]);
      setInvitations(invitationsData.invitations || []);
      // API returns { tenants: [...] } not { organizations: [...] }
      setOrganizations(orgsData.tenants || []);
    } catch (err) {
      console.error('Failed to load invitations:', err);
      setInvitations([]);
      setOrganizations([]);
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to load invitations',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSuccess = () => {
    fetchData();
    setCreateDialogOpen(false);
    toast({
      title: 'Success',
      description: 'Invitation created successfully',
    });
  };

  const handleResend = async (invitationId: string) => {
    try {
      setActionLoading(invitationId);
      await invitationService.resendInvitation(invitationId);
      toast({
        title: 'Success',
        description: 'Invitation resent successfully',
      });
      fetchData();
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to resend invitation',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevoke = async (invitationId: string) => {
    try {
      setActionLoading(invitationId);
      await invitationService.revokeInvitation(invitationId);
      toast({
        title: 'Success',
        description: 'Invitation revoked successfully',
      });
      fetchData();
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to revoke invitation',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: string, expiresAt: string) => {
    const isExpired = new Date(expiresAt) < new Date();

    if (status === 'accepted') {
      return (
        <Badge variant="default" className="bg-green-500">
          <CheckCircle className="w-3 h-3 mr-1" />
          Accepted
        </Badge>
      );
    }
    if (status === 'revoked') {
      return (
        <Badge variant="destructive">
          <XCircle className="w-3 h-3 mr-1" />
          Revoked
        </Badge>
      );
    }
    if (isExpired) {
      return (
        <Badge variant="secondary">
          <Clock className="w-3 h-3 mr-1" />
          Expired
        </Badge>
      );
    }
    return (
      <Badge variant="outline">
        <Clock className="w-3 h-3 mr-1" />
        Pending
      </Badge>
    );
  };

  const getOrganizationName = (tenantId: string) => {
    const org = organizations.find((o) => o.id === tenantId);
    return org?.name || 'Unknown';
  };

  const filteredInvitations = (invitations || []).filter((invitation) => {
    const matchesSearch = invitation.email?.toLowerCase().includes(searchQuery.toLowerCase());

    const isExpired = new Date(invitation.expiresAt) < new Date();
    let matchesStatus = true;

    if (statusFilter === 'pending') {
      matchesStatus = invitation.status === 'pending' && !isExpired;
    } else if (statusFilter === 'accepted') {
      matchesStatus = invitation.status === 'accepted';
    } else if (statusFilter === 'expired') {
      matchesStatus = isExpired && invitation.status === 'pending';
    } else if (statusFilter === 'revoked') {
      matchesStatus = invitation.status === 'revoked';
    }

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(ROUTES.DASHBOARD)}
                className="text-white hover:bg-slate-800"
              >
                <ArrowLeft className="w-6 h-6" />
              </Button>
              <div>
                <h1 className="text-4xl font-bold text-white flex items-center gap-3">
                  <Mail className="w-10 h-10 text-primary" />
                  Invitations
                </h1>
                <p className="text-slate-400 mt-2">Manage user invitations</p>
              </div>
            </div>

            <Button onClick={() => setCreateDialogOpen(true)} size="lg">
              <Plus className="w-5 h-5 mr-2" />
              Create Invitation
            </Button>
          </div>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <Input
                    placeholder="Search by email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="accepted">Accepted</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                    <SelectItem value="revoked">Revoked</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Invitations Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>All Invitations ({filteredInvitations.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center items-center h-64">
                  <Loader2 className="w-12 h-12 text-primary animate-spin" />
                </div>
              ) : filteredInvitations.length === 0 ? (
                <div className="text-center py-12">
                  <Mail className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-2">No invitations found</p>
                  <p className="text-sm text-gray-500">
                    {searchQuery || statusFilter !== 'all'
                      ? 'Try adjusting your filters'
                      : 'Create your first invitation'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Organization</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Invited By</TableHead>
                        <TableHead>Expires At</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInvitations.map((invitation) => {
                        const isExpired = new Date(invitation.expiresAt) < new Date();
                        const canResend = invitation.status === 'pending' && !isExpired;
                        const canRevoke = invitation.status === 'pending';

                        return (
                          <TableRow key={invitation.id}>
                            <TableCell className="font-medium">{invitation.email}</TableCell>
                            <TableCell>{getOrganizationName(invitation.tenantId)}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{invitation.role}</Badge>
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(invitation.status, invitation.expiresAt)}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {invitation.invitedBy?.username || 'System'}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {new Date(invitation.expiresAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                {canResend && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleResend(invitation.id)}
                                    disabled={actionLoading === invitation.id}
                                  >
                                    {actionLoading === invitation.id ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <>
                                        <RefreshCw className="w-4 h-4 mr-1" />
                                        Resend
                                      </>
                                    )}
                                  </Button>
                                )}
                                {canRevoke && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRevoke(invitation.id)}
                                    disabled={actionLoading === invitation.id}
                                  >
                                    {actionLoading === invitation.id ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <>
                                        <XCircle className="w-4 h-4 mr-1" />
                                        Revoke
                                      </>
                                    )}
                                  </Button>
                                )}
                                {!canResend && !canRevoke && (
                                  <span className="text-xs text-muted-foreground">No actions</span>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Dialog */}
      <CreateInvitationDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={handleCreateSuccess}
        organizations={organizations}
      />
    </div>
  );
};
