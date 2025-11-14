import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Share2,
  Download,
  Flag,
  CheckCircle,
  AlertTriangle,
  Eye,
  Calendar,
  User,
  Clock,
  Edit,
  Trash2
} from 'lucide-react';
import { VideoPlayer } from '@components/video/VideoPlayer';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import { Button } from '@components/ui/button';
import { Badge } from '@components/ui/badge';
import { Progress } from '@components/ui/progress';
import { useVideoStore } from '@store/videoStore';
import { useAuthStore } from '@store/authStore';
import { useSocket } from '@hooks/useSocket';
import videoService from '@services/video.service';
import type { Video } from '@types/index';
import { formatDuration, formatRelativeTime, formatBytes, formatNumber } from '@utils/formatters';
import { getRolePermissions } from '@utils/rbac';
import { ROUTES } from '@utils/constants';

export const VideoDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentVideo, setCurrentVideo } = useVideoStore();
  const { user } = useAuthStore();
  const { joinVideoRoom, leaveVideoRoom } = useSocket();
  const [streamingUrl, setStreamingUrl] = useState<string | null>(null);
  const [fallbackMp4Url, setFallbackMp4Url] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [directStreamUrl, setDirectStreamUrl] = useState<string | null>(null);

  // Parse tags if they're stored as a JSON string (for backwards compatibility)
  const parseTags = (tags: any): string[] => {
    if (!tags) return [];

    // If it's already an array, check if elements are JSON strings
    if (Array.isArray(tags)) {
      const parsed: string[] = [];
      tags.forEach(tag => {
        if (typeof tag === 'string') {
          // Try to parse each element in case it's a JSON string like '["SIH"]'
          try {
            const innerParsed = JSON.parse(tag);
            if (Array.isArray(innerParsed)) {
              parsed.push(...innerParsed);
            } else {
              parsed.push(tag);
            }
          } catch {
            // Not JSON, just a regular string
            parsed.push(tag);
          }
        } else {
          parsed.push(String(tag));
        }
      });
      return parsed.filter(Boolean);
    }

    // If it's a string, try to parse it
    if (typeof tags === 'string') {
      try {
        const parsed = JSON.parse(tags);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return tags.split(',').map(t => t.trim()).filter(Boolean);
      }
    }

    return [];
  };

  // Check permissions
  const permissions = user ? getRolePermissions(user.role) : null;
  const isOwner = user && currentVideo ? currentVideo.uploadedBy === user.id : false;
  const canEditVideo = permissions?.canEdit && (isOwner || user?.role === 'admin');
  const canDeleteVideo = permissions?.canDelete && (isOwner || user?.role === 'admin');
  const canModerateVideo = permissions?.canModerate;

  useEffect(() => {
    if (!id) return;

    const loadVideo = async () => {
      try {
        setIsLoading(true);

        // Fetch video details
        const video = await videoService.getVideoById(id);
        setCurrentVideo(video);

        // Get streaming URL if ready
        if (video.status === 'ready') {
          try {
            const streamingData = await videoService.getStreamingUrl(id);
            // Use HLS if available, fallback to MP4, then CDN URL
            const url = streamingData.hlsUrl || streamingData.mp4Url || video.cdnUrl;
            setStreamingUrl(url);
            if (streamingData.mp4Url) setFallbackMp4Url(streamingData.mp4Url);
            if (streamingData.directStreamUrl) setDirectStreamUrl(streamingData.directStreamUrl);
            console.log('Streaming URL loaded:', url);
          } catch (err) {
            console.error('Failed to get streaming URL:', err);
            setError('Video is ready but streaming URL could not be loaded. Please try again.');
          }
        }

        // Watch video for real-time updates
        joinVideoRoom(id);
      } catch (err: any) {
        setError(err.response?.data?.error || err.message || 'Failed to load video');
      } finally {
        setIsLoading(false);
      }
    };

    loadVideo();

    return () => {
      if (id) {
        leaveVideoRoom(id);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Watch for status changes via socket updates and fetch streaming URL when ready
  useEffect(() => {
    if (!currentVideo || !id) return;

    // If video just became ready and we don't have a streaming URL, fetch it
    if (currentVideo.status === 'ready' && !streamingUrl) {
      const fetchStreamingUrl = async () => {
        try {
          const streamingData = await videoService.getStreamingUrl(id);
          // Use HLS if available, fallback to MP4, then CDN URL
          const url = streamingData.hlsUrl || streamingData.mp4Url || currentVideo.cdnUrl;
          setStreamingUrl(url);
          if (streamingData.mp4Url) setFallbackMp4Url(streamingData.mp4Url);
          if (streamingData.directStreamUrl) setDirectStreamUrl(streamingData.directStreamUrl);
          setError(null); // Clear any previous errors
          console.log('✅ Streaming URL fetched after status change:', url);
        } catch (err) {
          console.error('Failed to get streaming URL:', err);
          setError('Video is ready but streaming URL could not be loaded. Please try again.');
        }
      };

      fetchStreamingUrl();
    }
  }, [currentVideo?.status, id, streamingUrl]);

  const handleDelete = async () => {
    if (!currentVideo || !window.confirm('Are you sure you want to delete this video?')) {
      return;
    }

    try {
      await videoService.deleteVideo(currentVideo.id);
      navigate(ROUTES.LIBRARY);
    } catch (err: any) {
      alert('Failed to delete video: ' + err.message);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading video...</p>
        </div>
      </div>
    );
  }

  if (error || !currentVideo) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="p-8 text-center max-w-md">
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Error</h2>
          <p className="text-muted-foreground mb-4">{error || 'Video not found'}</p>
          <Button onClick={() => navigate(ROUTES.LIBRARY)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Library
          </Button>
        </Card>
      </div>
    );
  }

  const video = currentVideo;
  const isProcessing = ['uploading', 'queued', 'processing', 'transcoding', 'analyzing'].includes(video.status);
  const isReady = video.status === 'ready';
  const isFailed = video.status === 'failed';

  return (
    <div className="container max-w-7xl mx-auto p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Back Button */}
        <Button
          variant="ghost"
          className="mb-4"
          onClick={() => navigate(ROUTES.LIBRARY)}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Library
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Video Player Section */}
          <div className="lg:col-span-2 space-y-6">
            {/* Player */}
            {isReady && streamingUrl ? (
              <VideoPlayer
                videoId={video.id}
                hlsUrl={streamingUrl}
                fallbackMp4Url={fallbackMp4Url || undefined}
                backendFallbackUrl={directStreamUrl || undefined}
                poster={video.processedFiles?.thumbnail}
              />
            ) : isProcessing ? (
              <Card className="aspect-video bg-muted flex items-center justify-center">
                <div className="text-center">
                  <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Processing Video</h3>
                  <p className="text-muted-foreground mb-2">This may take a few minutes...</p>
                  <div className="max-w-xs mx-auto">
                    <Progress value={video.processingProgress ?? 0} className="h-2 mb-2" />
                    <p className="text-2xl font-bold text-primary">{video.processingProgress ?? 0}%</p>
                  </div>
                </div>
              </Card>
            ) : isFailed ? (
              <Card className="aspect-video bg-muted flex items-center justify-center">
                <div className="text-center">
                  <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
                  <p className="font-medium text-lg mb-2">Processing Failed</p>
                  <p className="text-muted-foreground">This video could not be processed</p>
                </div>
              </Card>
            ) : (
              <Card className="aspect-video bg-muted flex items-center justify-center">
                <div className="text-center">
                  <Eye className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Video not ready</p>
                </div>
              </Card>
            )}

            {/* Video Info */}
            <Card className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h1 className="text-2xl font-bold mb-2">{video.title}</h1>
                  <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                    {video.views !== undefined && (
                      <span className="flex items-center">
                        <Eye className="w-4 h-4 mr-1" />
                        {formatNumber(video.views)} views
                      </span>
                    )}
                    <span className="flex items-center">
                      <Calendar className="w-4 h-4 mr-1" />
                      {formatRelativeTime(video.uploadedAt)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Button variant="outline" size="sm">
                    <Share2 className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm">
                    <Download className="w-4 h-4" />
                  </Button>
                  {canModerateVideo && (
                    <Button variant="outline" size="sm">
                      <Flag className="w-4 h-4" />
                    </Button>
                  )}
                  {canDeleteVideo && (
                    <Button variant="outline" size="sm" onClick={handleDelete}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Uploader Info */}
              {video.uploader && (
                <div className="flex items-center space-x-3 pb-4 border-b">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">
                      {video.uploader.firstName} {video.uploader.lastName}
                    </p>
                    <p className="text-sm text-muted-foreground">Uploader</p>
                  </div>
                </div>
              )}

              {/* Description */}
              {video.description && (
                <div className="pt-4">
                  <h3 className="font-semibold mb-2">Description</h3>
                  <p className="text-muted-foreground whitespace-pre-wrap">
                    {video.description}
                  </p>
                </div>
              )}
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Status Card */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3">Video Status</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Processing</span>
                  <Badge variant={isReady ? 'default' : 'secondary'}>
                    {video.status}
                  </Badge>
                </div>
                {video.aiAnalysis && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">AI Analysis</span>
                    {video.aiAnalysis.status === 'safe' ? (
                      <Badge className="bg-green-500">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Safe
                      </Badge>
                    ) : video.aiAnalysis.status === 'flagged' ? (
                      <Badge className="bg-red-500">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        Flagged
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        {video.aiAnalysis.status}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </Card>

            {/* AI Analysis Card */}
            {video.aiAnalysis?.categories && video.aiAnalysis.categories.length > 0 && (
              <Card className="p-4">
                <h3 className="font-semibold mb-3">Content Analysis</h3>
                <div className="space-y-2">
                  {video.aiAnalysis.categories.map((category: any) => (
                    <div key={category.name}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="capitalize">{category.name}</span>
                        <span className="font-medium">
                          {category.severity}/6
                        </span>
                      </div>
                      <div className="h-2 bg-secondary rounded-full overflow-hidden">
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

                {video.aiAnalysis.overallScore !== undefined && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Overall Score</span>
                      <span className="text-2xl font-bold text-primary">
                        {video.aiAnalysis.overallScore}/100
                      </span>
                    </div>
                  </div>
                )}
              </Card>
            )}

            {/* Metadata Card */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3">Details</h3>
              <dl className="space-y-2 text-sm">
                {video.category && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Category</dt>
                    <dd className="font-medium capitalize">{video.category}</dd>
                  </div>
                )}
                {video.originalFile?.duration && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Duration</dt>
                    <dd className="font-medium">{formatDuration(video.originalFile.duration)}</dd>
                  </div>
                )}
                {video.originalFile?.fileSize && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">File Size</dt>
                    <dd className="font-medium">{formatBytes(video.originalFile.fileSize)}</dd>
                  </div>
                )}
                {video.originalFile?.resolution && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Resolution</dt>
                    <dd className="font-medium">
                      {video.originalFile.resolution.width}x{video.originalFile.resolution.height}
                    </dd>
                  </div>
                )}
                {video.tags && video.tags.length > 0 && (
                  <div>
                    <dt className="text-muted-foreground mb-1">Tags</dt>
                    <dd className="flex flex-wrap gap-1">
                      {parseTags(video.tags).map((tag, index) => (
                        <Badge key={`${tag}-${index}`} variant="secondary" className="text-xs rounded-full font-medium">
                          #{tag}
                        </Badge>
                      ))}
                    </dd>
                  </div>
                )}
              </dl>
            </Card>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
