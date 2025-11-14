import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Video,
  CheckCircle,
  Clock,
  AlertTriangle,
  Eye,
  Upload,
  TrendingUp,
  PlayCircle,
  LogIn
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import { Button } from '@components/ui/button';
import { VideoGrid } from '@components/video/VideoGrid';
import { Header } from '@components/layout';
import { useVideoStore } from '@store/videoStore';
import { useAuthStore } from '@store/authStore';
import { ROUTES, STORAGE_KEYS } from '@utils/constants';
import { formatNumber } from '@utils/formatters';
import { getRolePermissions } from '@utils/rbac';

interface DashboardStats {
  totalVideos: number;
  readyVideos: number;
  processingVideos: number;
  failedVideos: number;
  totalViews: number;
  totalStorage: number;
  flaggedVideos: number;
  recentUploads: number;
}

export const DashboardPage = () => {
  const navigate = useNavigate();
  const { videos, fetchVideos, pagination } = useVideoStore();
  const { isAuthenticated: authStoreAuthenticated, user } = useAuthStore();

  // Check permissions
  const permissions = user ? getRolePermissions(user.role) : null;

  const [stats, setStats] = useState<DashboardStats>({
    totalVideos: 0,
    readyVideos: 0,
    processingVideos: 0,
    failedVideos: 0,
    totalViews: 0,
    totalStorage: 0,
    flaggedVideos: 0,
    recentUploads: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setIsLoading(true);
        // Check if user is authenticated using authStore
        const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
        if (!token || !authStoreAuthenticated) {
          setIsAuthenticated(false);
          return;
        }
        setIsAuthenticated(true);
        await fetchVideos({ page: 1, limit: 10 });
      } catch (error) {
        console.error('Failed to load dashboard:', error);
        // If 401, redirect to login
        if (error instanceof Error && error.message.includes('401')) {
          setIsAuthenticated(false);
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboard();
  }, [fetchVideos, authStoreAuthenticated]);

  // Calculate stats from videos
  useEffect(() => {
    const now = new Date();
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const calculatedStats: DashboardStats = {
      totalVideos: pagination.total || videos.length,
      readyVideos: videos.filter(v => v.status === 'ready').length,
      processingVideos: videos.filter(v => ['uploading', 'queued', 'processing'].includes(v.status)).length,
      failedVideos: videos.filter(v => v.status === 'failed').length,
      totalViews: videos.reduce((sum, v) => sum + (v.views || 0), 0),
      totalStorage: videos.reduce((sum, v) => sum + (v.originalFile?.fileSize || 0), 0),
      flaggedVideos: videos.filter(v => v.aiAnalysis?.status === 'flagged').length,
      recentUploads: videos.filter(v => new Date(v.uploadedAt) > lastWeek).length,
    };

    setStats(calculatedStats);
  }, [videos, pagination]);

  const statCards = [
    {
      title: 'Total Videos',
      value: formatNumber(stats.totalVideos),
      icon: Video,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      trend: `+${stats.recentUploads} this week`,
    },
    {
      title: 'Ready to Watch',
      value: formatNumber(stats.readyVideos),
      icon: CheckCircle,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
      trend: `${Math.round((stats.readyVideos / Math.max(stats.totalVideos, 1)) * 100)}% ready`,
    },
    {
      title: 'Processing',
      value: formatNumber(stats.processingVideos),
      icon: Clock,
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
      trend: stats.processingVideos > 0 ? 'In progress' : 'All complete',
    },
    {
      title: 'Failed',
      value: formatNumber(stats.failedVideos),
      icon: AlertTriangle,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
      trend: stats.failedVideos > 0 ? 'Needs attention' : 'All good',
    },
    {
      title: 'Total Views',
      value: formatNumber(stats.totalViews),
      icon: Eye,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
      trend: 'All time',
    },
    {
      title: 'Flagged Content',
      value: formatNumber(stats.flaggedVideos),
      icon: AlertTriangle,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
      trend: stats.flaggedVideos > 0 ? 'Requires review' : 'All clear',
    },
  ];

  const handleVideoClick = (videoId: string) => {
    navigate(`${ROUTES.VIDEOS}/${videoId}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl flex items-center justify-center gap-2">
              <LogIn className="w-6 h-6" />
              Login Required
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              Please login to access your video dashboard and upload videos.
            </p>
            <div className="flex gap-2 justify-center">
              <Button onClick={() => navigate(ROUTES.LOGIN)}>
                Login
              </Button>
              <Button variant="outline" onClick={() => navigate(ROUTES.REGISTER)}>
                Register
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container max-w-7xl mx-auto p-6 space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Overview of your video library and analytics
            </p>
          </div>
          <div className="flex gap-2">
            {permissions?.canUpload && (
              <Button onClick={() => navigate(ROUTES.UPLOAD)}>
                <Upload className="w-4 h-4 mr-2" />
                Upload Video
              </Button>
            )}
            <Button variant="outline" onClick={() => navigate(ROUTES.LIBRARY)}>
              <Video className="w-4 h-4 mr-2" />
              Library
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {statCards.map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
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
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="w-5 h-5 mr-2" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {permissions?.canUpload && (
              <Button
                variant="outline"
                onClick={() => navigate(ROUTES.UPLOAD)}
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload New Video
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => navigate(ROUTES.LIBRARY)}
            >
              <Video className="w-4 h-4 mr-2" />
              Browse Library
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                useVideoStore.setState(state => ({
                  ...state,
                  filters: { ...state.filters, status: ['processing', 'queued'] }
                }));
                navigate(ROUTES.LIBRARY);
              }}
            >
              <Clock className="w-4 h-4 mr-2" />
              View Processing ({stats.processingVideos})
            </Button>
            {stats.flaggedVideos > 0 && (
              <Button
                variant="outline"
                onClick={() => {
                  useVideoStore.setState(state => ({
                    ...state,
                    filters: { ...state.filters, classification: 'flagged' }
                  }));
                  navigate(ROUTES.LIBRARY);
                }}
              >
                <AlertTriangle className="w-4 h-4 mr-2" />
                Review Flagged ({stats.flaggedVideos})
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Recent Videos */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center">
                <PlayCircle className="w-5 h-5 mr-2" />
                Recent Videos
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(ROUTES.LIBRARY)}
              >
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {videos.length > 0 ? (
              <VideoGrid
                videos={videos.slice(0, 6)}
                onVideoClick={handleVideoClick}
              />
            ) : (
              <div className="text-center py-12">
                <Video className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">
                  {permissions?.canUpload
                    ? 'No videos yet. Upload your first video to get started!'
                    : 'No videos available to watch yet.'}
                </p>
                {permissions?.canUpload && (
                  <Button onClick={() => navigate(ROUTES.UPLOAD)}>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Video
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
      </div>
    </div>
  );
};
