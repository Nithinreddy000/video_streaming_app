import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Users,
  Building2,
  Mail,
  TrendingUp,
  Database,
  Video,
  HardDrive,
  Activity
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import { Button } from '@components/ui/button';
import { useAuthStore } from '@store/authStore';
import adminService, { type SystemStats } from '@services/admin.service';
import { formatNumber, formatBytes } from '@utils/formatters';
import { ROUTES } from '@utils/constants';

export const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is admin
    if (user?.role !== 'admin') {
      navigate(ROUTES.DASHBOARD);
      return;
    }

    loadStats();
  }, [user, navigate]);

  const loadStats = async () => {
    try {
      setIsLoading(true);
      const { stats: systemStats } = await adminService.getSystemStats();
      setStats(systemStats);
    } catch (error) {
      console.error('Failed to load admin stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || !stats) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Organizations',
      value: formatNumber(stats.tenants.total),
      icon: Building2,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      trend: `${stats.tenants.active} active`,
      onClick: () => navigate('/admin/organizations'),
    },
    {
      title: 'Total Users',
      value: formatNumber(stats.users.total),
      icon: Users,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
      trend: `${stats.users.active} active`,
      onClick: () => navigate('/admin/users'),
    },
    {
      title: 'Storage Used',
      value: formatBytes(stats.storage.totalUsedGB * 1024 * 1024 * 1024),
      icon: HardDrive,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
      trend: `${formatBytes(stats.storage.totalLimitGB * 1024 * 1024 * 1024)} total`,
    },
    {
      title: 'Total Videos',
      value: formatNumber(stats.storage.totalVideos),
      icon: Video,
      color: 'text-cyan-500',
      bgColor: 'bg-cyan-500/10',
      trend: `${formatNumber(stats.storage.totalStreams)} streams`,
    },
    {
      title: 'Admins',
      value: formatNumber(stats.users.byRole.admin || 0),
      icon: Users,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
      trend: 'System administrators',
    },
    {
      title: 'Editors',
      value: formatNumber(stats.users.byRole.editor || 0),
      icon: Users,
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
      trend: 'Content editors',
    },
  ];

  return (
    <div className="container max-w-7xl mx-auto p-6 space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              System-wide statistics and management
            </p>
          </div>
          <Button onClick={loadStats} variant="outline">
            <Activity className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {statCards.map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              onClick={stat.onClick}
              className={stat.onClick ? 'cursor-pointer' : ''}
            >
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {stat.title}
                  </CardTitle>
                  <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                    <stat.icon className={`w-4 h-4 ${stat.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stat.trend}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="w-5 h-5 mr-2" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button onClick={() => navigate('/admin/organizations')}>
              <Building2 className="w-4 h-4 mr-2" />
              Manage Organizations
            </Button>
            <Button onClick={() => navigate('/admin/users')}>
              <Users className="w-4 h-4 mr-2" />
              Manage Users
            </Button>
            <Button onClick={() => navigate('/admin/invitations')}>
              <Mail className="w-4 h-4 mr-2" />
              Send Invitations
            </Button>
            <Button variant="outline" onClick={() => navigate(ROUTES.DASHBOARD)}>
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>

        {/* Organization Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Organizations by Plan</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(stats.tenants.byPlan).map(([plan, count]) => (
                  <div key={plan} className="flex items-center justify-between">
                    <span className="capitalize">{plan}</span>
                    <span className="font-semibold">{count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Users by Role</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(stats.users.byRole).map(([role, count]) => (
                  <div key={role} className="flex items-center justify-between">
                    <span className="capitalize">{role}</span>
                    <span className="font-semibold">{count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </motion.div>
    </div>
  );
};
