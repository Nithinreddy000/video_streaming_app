import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  Calendar,
  User,
  Shield,
  ArrowLeft
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import { Button } from '@components/ui/button';
import { Badge } from '@components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@components/ui/tabs';
import { useVideoStore } from '@store/videoStore';
import videoService from '@services/video.service';
import type { Video } from '@types/index';
import { formatRelativeTime, formatNumber } from '@utils/formatters';
import { ROUTES } from '@utils/constants';

interface ModerationStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

export const AdminModerationPage = () => {
  const navigate = useNavigate();
  const { videos, fetchVideos } = useVideoStore();
  const [stats, setStats] = useState<ModerationStats>({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Filter videos that need moderation
  const flaggedVideos = videos.filter(
    v => v.aiAnalysis?.status === 'flagged'
  );
  const approvedVideos = videos.filter(
    v => v.aiAnalysis?.status === 'safe' && v.status === 'ready'
  );
  const blockedVideos = videos.filter(
    v => v.aiAnalysis?.status === 'blocked'
  );

  useEffect(() => {
    const loadModerationData = async () => {
      try {
        setIsLoading(true);
        await fetchVideos({ page: 1, limit: 100 });
      } catch (error) {
        console.error('Failed to load moderation data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadModerationData();
  }, [fetchVideos]);

  // Calculate stats
  useEffect(() => {
    setStats({
      total: videos.length,
      pending: flaggedVideos.length,
      approved: approvedVideos.length,
      rejected: blockedVideos.length,
    });
  }, [videos, flaggedVideos, approvedVideos, blockedVideos]);

  const handleApprove = async (videoId: string) => {
    try {
      setActionLoading(videoId);
      await videoService.reviewVideo(videoId, 'approved');
      await fetchVideos({ page: 1, limit: 100 });
    } catch (error: any) {
      alert('Failed to approve video: ' + error.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (videoId: string) => {
    try {
      setActionLoading(videoId);
      await videoService.reviewVideo(videoId, 'rejected');
      await fetchVideos({ page: 1, limit: 100 });
    } catch (error: any) {
      alert('Failed to reject video: ' + error.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleViewVideo = (videoId: string) => {
    navigate(`${ROUTES.VIDEOS}/${videoId}`);
  };

  const renderVideoCard = (video: Video) => (
    <motion.div
      key={video.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg mb-2">{video.title}</CardTitle>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                {video.uploader && (
                  <span className="flex items-center">
                    <User className="w-4 h-4 mr-1" />
                    {video.uploader.firstName} {video.uploader.lastName}
                  </span>
                )}
                <span className="flex items-center">
                  <Calendar className="w-4 h-4 mr-1" />
                  {formatRelativeTime(video.uploadedAt)}
                </span>
                {video.views !== undefined && (
                  <span className="flex items-center">
                    <Eye className="w-4 h-4 mr-1" />
                    {formatNumber(video.views)}
                  </span>
                )}
              </div>
            </div>
            <Badge
              variant={
                video.aiAnalysis?.status === 'flagged'
                  ? 'destructive'
                  : video.aiAnalysis?.status === 'safe'
                  ? 'default'
                  : 'secondary'
              }
            >
              {video.aiAnalysis?.status || 'pending'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {/* AI Analysis Details */}
          {video.aiAnalysis?.categories && video.aiAnalysis.categories.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold mb-2">Content Analysis</h4>
              <div className="space-y-2">
                {video.aiAnalysis.categories.map((category: any) => (
                  <div key={category.name}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="capitalize">{category.name}</span>
                      <span
                        className={`font-medium ${
                          category.severity >= 4
                            ? 'text-red-500'
                            : category.severity >= 2
                            ? 'text-yellow-500'
                            : 'text-green-500'
                        }`}
                      >
                        {category.severity}/6
                      </span>
                    </div>
                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          category.severity >= 4
                            ? 'bg-red-500'
                            : category.severity >= 2
                            ? 'bg-yellow-500'
                            : 'bg-green-500'
                        }`}
                        style={{ width: `${(category.severity / 6) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          {video.description && (
            <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
              {video.description}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleViewVideo(video.id)}
            >
              <Eye className="w-4 h-4 mr-1" />
              View
            </Button>
            {video.aiAnalysis?.status === 'flagged' && (
              <>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => handleApprove(video.id)}
                  disabled={actionLoading === video.id}
                >
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Approve
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleReject(video.id)}
                  disabled={actionLoading === video.id}
                >
                  <XCircle className="w-4 h-4 mr-1" />
                  Reject
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading moderation queue...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Button
          variant="ghost"
          className="mb-4"
          onClick={() => navigate(ROUTES.DASHBOARD)}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>

        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-primary/10 rounded-lg">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Content Moderation</h1>
            <p className="text-muted-foreground">
              Review and manage flagged content
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Videos</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <Eye className="w-8 h-8 text-blue-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending Review</p>
                  <p className="text-2xl font-bold text-yellow-500">{stats.pending}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-yellow-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Approved</p>
                  <p className="text-2xl font-bold text-green-500">{stats.approved}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Rejected</p>
                  <p className="text-2xl font-bold text-red-500">{stats.rejected}</p>
                </div>
                <XCircle className="w-8 h-8 text-red-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>
      </motion.div>

      {/* Moderation Tabs */}
      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="flagged" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="flagged">
                Flagged ({flaggedVideos.length})
              </TabsTrigger>
              <TabsTrigger value="approved">
                Approved ({approvedVideos.length})
              </TabsTrigger>
              <TabsTrigger value="blocked">
                Blocked ({blockedVideos.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="flagged" className="space-y-4">
              {flaggedVideos.length > 0 ? (
                flaggedVideos.map(renderVideoCard)
              ) : (
                <div className="text-center py-12">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    No videos pending review. All content is clear!
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="approved" className="space-y-4">
              {approvedVideos.length > 0 ? (
                approvedVideos.map(renderVideoCard)
              ) : (
                <div className="text-center py-12">
                  <Eye className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    No approved videos yet.
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="blocked" className="space-y-4">
              {blockedVideos.length > 0 ? (
                blockedVideos.map(renderVideoCard)
              ) : (
                <div className="text-center py-12">
                  <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    No blocked videos.
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};
