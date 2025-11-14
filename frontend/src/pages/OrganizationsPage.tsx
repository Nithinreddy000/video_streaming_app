import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Building2, Plus, Search, Loader2, Building, Users, Calendar, ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Badge } from '@components/ui/badge';
import { CreateOrganizationDialog } from '@components/admin/CreateOrganizationDialog';
import { EditOrganizationDialog } from '@components/admin/EditOrganizationDialog';
import { ManageUserGroupsDialog } from '@components/admin/ManageUserGroupsDialog';
import organizationService from '@services/organization.service';
import { useAuthStore } from '@store/authStore';
import { useToast } from '@hooks/use-toast';
import { ROUTES } from '@utils/constants';

export const OrganizationsPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuthStore();

  const [organizations, setOrganizations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [userGroupsDialogOpen, setUserGroupsDialogOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<any>(null);

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    try {
      setLoading(true);
      const data = await organizationService.getAllOrganizations();
      console.log('Fetched organizations data:', data);
      // API returns { tenants: [...] } not { organizations: [...] }
      setOrganizations(data.tenants || []);
    } catch (err) {
      console.error('Failed to load organizations:', err);
      setOrganizations([]);
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to load organizations',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSuccess = () => {
    fetchOrganizations();
    setCreateDialogOpen(false);
    toast({
      title: 'Success',
      description: 'Organization created successfully',
    });
  };

  const handleEditSuccess = () => {
    fetchOrganizations();
    setEditDialogOpen(false);
    setSelectedOrg(null);
    toast({
      title: 'Success',
      description: 'Organization updated successfully',
    });
  };

  const handleEdit = (org: any) => {
    setSelectedOrg(org);
    setEditDialogOpen(true);
  };

  const handleManageGroups = (org: any) => {
    setSelectedOrg(org);
    setUserGroupsDialogOpen(true);
  };

  const handleUserGroupsSuccess = () => {
    fetchOrganizations();
    toast({
      title: 'Success',
      description: 'User groups updated successfully',
    });
  };

  const filteredOrganizations = (organizations || []).filter((org) =>
    org.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    org.slug?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
                  <Building2 className="w-10 h-10 text-primary" />
                  Organizations
                </h1>
                <p className="text-slate-400 mt-2">Manage tenant organizations</p>
              </div>
            </div>

            <Button onClick={() => setCreateDialogOpen(true)} size="lg">
              <Plus className="w-5 h-5 mr-2" />
              Create Organization
            </Button>
          </div>
        </motion.div>

        {/* Search */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          <Card>
            <CardContent className="pt-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  placeholder="Search organizations by name or slug..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Organizations Grid */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
          </div>
        ) : filteredOrganizations.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <Building className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">No organizations found</p>
              <p className="text-sm text-gray-500">
                {searchQuery ? 'Try adjusting your search' : 'Create your first organization'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredOrganizations.map((org, index) => (
              <motion.div
                key={org.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="flex items-center gap-2">
                          <Building2 className="w-5 h-5 text-primary" />
                          {org.name}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          /{org.slug}
                        </p>
                      </div>
                      <Badge variant={org.isActive ? 'default' : 'secondary'}>
                        {org.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Users className="w-4 h-4 mr-2" />
                        <span>{org.userCount || 0} users</span>
                      </div>

                      <div className="flex items-center text-sm text-muted-foreground">
                        <Calendar className="w-4 h-4 mr-2" />
                        <span>Created {new Date(org.createdAt).toLocaleDateString()}</span>
                      </div>

                      {org.settings && Object.keys(org.settings).length > 0 && (
                        <div className="text-xs text-muted-foreground pt-2 border-t">
                          {Object.keys(org.settings).length} custom settings
                        </div>
                      )}

                      <div className="pt-3 space-y-2">
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => handleEdit(org)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => handleManageGroups(org)}
                          >
                            <Users className="w-4 h-4 mr-1" />
                            Manage Groups
                          </Button>
                        </div>
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
      <CreateOrganizationDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onSuccess={handleCreateSuccess}
      />

      {selectedOrg && (
        <EditOrganizationDialog
          open={editDialogOpen}
          onOpenChange={(open) => {
            setEditDialogOpen(open);
            if (!open) setSelectedOrg(null);
          }}
          organization={selectedOrg}
          onSuccess={handleEditSuccess}
        />
      )}

      {selectedOrg && (
        <ManageUserGroupsDialog
          open={userGroupsDialogOpen}
          onOpenChange={(open) => {
            setUserGroupsDialogOpen(open);
            if (!open) setSelectedOrg(null);
          }}
          organization={selectedOrg}
          onSuccess={handleUserGroupsSuccess}
        />
      )}
    </div>
  );
};
