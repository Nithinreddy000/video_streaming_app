import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, Plus, Search, Loader2, User, Mail, Calendar, Building2, Shield, ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Badge } from '@components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select';
import { CreateUserDialog } from '@components/admin/CreateUserDialog';
import { EditUserDialog } from '@components/admin/EditUserDialog';
import userService from '@services/user.service';
import organizationService from '@services/organization.service';
import { useAuthStore } from '@store/authStore';
import { useToast } from '@hooks/use-toast';
import { ROUTES } from '@utils/constants';

export const UsersPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user: currentUser } = useAuthStore();

  const [users, setUsers] = useState<any[]>([]);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [usersData, orgsData] = await Promise.all([
        userService.getAllUsers(),
        organizationService.getAllOrganizations(),
      ]);
      setUsers(usersData.users || []);
      // API returns { tenants: [...] } not { organizations: [...] }
      setOrganizations(orgsData.tenants || []);
    } catch (err) {
      console.error('Failed to load users:', err);
      setUsers([]);
      setOrganizations([]);
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to load users',
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
      description: 'User created successfully',
    });
  };

  const handleEditSuccess = () => {
    fetchData();
    setEditDialogOpen(false);
    setSelectedUser(null);
    toast({
      title: 'Success',
      description: 'User updated successfully',
    });
  };

  const handleEdit = (user: any) => {
    setSelectedUser(user);
    setEditDialogOpen(true);
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin':
        return 'destructive';
      case 'editor':
        return 'default';
      case 'viewer':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getOrganizationName = (tenantId: string) => {
    const org = organizations.find((o) => o.id === tenantId);
    return org?.name || 'Unknown';
  };

  const filteredUsers = (users || []).filter((user) => {
    const matchesSearch =
      user.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.lastName?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'active' && user.isActive) ||
      (statusFilter === 'inactive' && !user.isActive);

    return matchesSearch && matchesRole && matchesStatus;
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
                  <Users className="w-10 h-10 text-primary" />
                  Users
                </h1>
                <p className="text-slate-400 mt-2">Manage system users</p>
              </div>
            </div>

            <Button onClick={() => setCreateDialogOpen(true)} size="lg">
              <Plus className="w-5 h-5 mr-2" />
              Create User
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <Input
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="super_admin">Super Admin</SelectItem>
                    <SelectItem value="tenant_admin">Tenant Admin</SelectItem>
                    <SelectItem value="moderator">Moderator</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Users Grid */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <User className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">No users found</p>
              <p className="text-sm text-gray-500">
                {searchQuery || roleFilter !== 'all' || statusFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Create your first user'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredUsers.map((user, index) => (
              <motion.div
                key={user.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="flex items-center gap-2">
                          <User className="w-5 h-5 text-primary" />
                          {user.username}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          {user.firstName} {user.lastName}
                        </p>
                      </div>
                      <div className="flex flex-col gap-1">
                        <Badge variant={getRoleBadgeVariant(user.role)}>
                          {user.role}
                        </Badge>
                        <Badge variant={user.isActive ? 'default' : 'secondary'} className="text-xs">
                          {user.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent>
                    <div className="space-y-3">
                      {user.email && (
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Mail className="w-4 h-4 mr-2" />
                          <span className="truncate">{user.email}</span>
                        </div>
                      )}

                      {user.tenantId && (
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Building2 className="w-4 h-4 mr-2" />
                          <span className="truncate">{getOrganizationName(user.tenantId)}</span>
                        </div>
                      )}

                      <div className="flex items-center text-sm text-muted-foreground">
                        <Calendar className="w-4 h-4 mr-2" />
                        <span>Joined {new Date(user.createdAt).toLocaleDateString()}</span>
                      </div>

                      {user.permissions && user.permissions.length > 0 && (
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Shield className="w-4 h-4 mr-2" />
                          <span>{user.permissions.length} permissions</span>
                        </div>
                      )}

                      <div className="pt-3 flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleEdit(user)}
                          disabled={user.id === currentUser?.id}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => {
                            toast({
                              title: 'Coming Soon',
                              description: 'User details view',
                            });
                          }}
                        >
                          View Details
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <CreateUserDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={handleCreateSuccess}
        organizations={organizations}
      />

      {selectedUser && (
        <EditUserDialog
          open={editDialogOpen}
          onOpenChange={(open) => {
            setEditDialogOpen(open);
            if (!open) setSelectedUser(null);
          }}
          user={selectedUser}
          organizations={organizations}
          onSuccess={handleEditSuccess}
        />
      )}
    </div>
  );
};
