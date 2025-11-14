import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Building2, Plus, Search, Edit, Trash2, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import { Button } from '@components/ui/button';
import { Badge } from '@components/ui/badge';
import adminService from '@services/admin.service';
import type { Tenant } from '@types/index';

export const OrganizationsPage = () => {
  const navigate = useNavigate();
  const [organizations, setOrganizations] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadOrganizations();
  }, []);

  const loadOrganizations = async () => {
    try {
      setIsLoading(true);
      const { tenants } = await adminService.getAllTenants({ page: 1, limit: 100 });
      setOrganizations(tenants);
    } catch (error) {
      console.error('Failed to load organizations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredOrgs = organizations.filter(org =>
    org.name.toLowerCase().includes(search.toLowerCase()) ||
    org.slug.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading organizations...</p>
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
              <Building2 className="w-8 h-8 mr-3" />
              Organizations
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage all organizations and tenants
            </p>
          </div>
          <Button onClick={() => alert('Create organization form - to be implemented')}>
            <Plus className="w-4 h-4 mr-2" />
            Create Organization
          </Button>
        </div>

        {/* Search */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search organizations..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg"
              />
            </div>
          </CardContent>
        </Card>

        {/* Organizations List */}
        <div className="grid grid-cols-1 gap-4">
          {filteredOrgs.map((org) => (
            <motion.div
              key={org.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-3">
                        {org.name}
                        <Badge variant={org.isActive ? 'default' : 'secondary'}>
                          {org.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                        <Badge variant="outline">{org.subscription?.plan || 'free'}</Badge>
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {org.slug}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/admin/organizations/${org.id}/users`)}
                      >
                        <Users className="w-4 h-4 mr-2" />
                        Users
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Users</p>
                      <p className="font-semibold">{org.usage?.totalUsers || 0}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Videos</p>
                      <p className="font-semibold">{org.usage?.totalVideos || 0}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Storage</p>
                      <p className="font-semibold">{org.usage?.totalStorageUsedGB || 0} GB</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Status</p>
                      <p className="font-semibold capitalize">{org.subscription?.status || 'trial'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {filteredOrgs.length === 0 && (
          <Card className="p-12 text-center">
            <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No organizations found</p>
          </Card>
        )}
      </motion.div>
    </div>
  );
};
