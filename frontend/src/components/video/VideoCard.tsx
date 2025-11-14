import { motion } from 'framer-motion';
import { Play, Clock, User, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@components/ui/card';
import { Badge } from '@components/ui/badge';
import { Progress } from '@components/ui/progress';
import type { Video } from '@types/index';
import { formatDuration, formatRelativeTime, formatNumber } from '@utils/formatters';

interface VideoCardProps {
  video: Video;
  onClick?: () => void;
}

export const VideoCard: React.FC<VideoCardProps> = ({ video, onClick }) => {
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

  const displayTags = parseTags(video.tags);

  const getStatusBadge = () => {
    switch (video.status) {
      case 'uploading':
        return <Badge className="bg-blue-500">Uploading</Badge>;
      case 'processing':
      case 'transcoding':
      case 'analyzing':
        return <Badge className="bg-yellow-500">Processing</Badge>;
      case 'ready':
        return <Badge variant="default">Ready</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return null;
    }
  };

  const getAIStatusBadge = () => {
    if (!video.aiAnalysis) return null;

    switch (video.aiAnalysis.status) {
      case 'pending':
        return <Badge variant="secondary">AI Pending</Badge>;
      case 'analyzing':
        return <Badge className="bg-purple-500">Analyzing</Badge>;
      case 'safe':
        return <Badge className="bg-green-500">Safe</Badge>;
      case 'flagged':
        return <Badge variant="destructive">Flagged</Badge>;
      default:
        return null;
    }
  };

  const isProcessing = ['uploading', 'processing', 'transcoding', 'analyzing'].includes(video.status);
  const isReady = video.status === 'ready';
  const isFailed = video.status === 'failed';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
    >
      <Card
        className={`overflow-hidden cursor-pointer transition-shadow hover:shadow-lg ${
          onClick ? 'hover:border-primary' : ''
        }`}
        onClick={onClick}
      >
        {/* Thumbnail */}
        <div className="relative aspect-video bg-muted overflow-hidden">
          {video.processedFiles?.thumbnail ? (
            <img
              src={video.processedFiles.thumbnail}
              alt={video.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
              <div className="text-center text-muted-foreground">
                {isFailed && <AlertCircle className="w-12 h-12 mx-auto mb-2" />}
                {!isProcessing && !isFailed && <Play className="w-12 h-12 mx-auto mb-2" />}
                {!isProcessing && <p className="text-sm">{isFailed ? 'Processing failed' : 'No thumbnail'}</p>}
              </div>
            </div>
          )}

          {/* Play Overlay (for ready videos) */}
          {isReady && (
            <motion.div
              initial={{ opacity: 0 }}
              whileHover={{ opacity: 1 }}
              className="absolute inset-0 bg-black/40 flex items-center justify-center"
            >
              <motion.div
                whileHover={{ scale: 1.1 }}
                className="bg-white rounded-full p-4"
              >
                <Play className="w-8 h-8 text-black fill-black" />
              </motion.div>
            </motion.div>
          )}

          {/* Processing Overlay */}
          {isProcessing && (
            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center p-4">
              <Loader2 className="w-10 h-10 text-white animate-spin mb-2" />
              <p className="text-white text-sm mb-2">Processing</p>
              {video.processingProgress !== undefined && (
                <div className="w-full max-w-[80%]">
                  <Progress value={video.processingProgress} className="h-2" />
                  <p className="text-white text-xs text-center mt-1">
                    {video.processingProgress}%
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Duration Badge */}
          {video.originalFile?.duration && (
            <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded">
              {formatDuration(video.originalFile.duration)}
            </div>
          )}

          {/* Status Badges */}
          <div className="absolute top-2 left-2 flex gap-2">
            {getStatusBadge()}
            {getAIStatusBadge()}
          </div>
        </div>

        {/* Content */}
        <CardContent className="p-4">
          <h3 className="font-semibold text-sm line-clamp-2 mb-2">{video.title}</h3>

          {video.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
              {video.description}
            </p>
          )}

          {/* Metadata */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              {video.uploader && (
                <div className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  <span>{video.uploader.firstName}</span>
                </div>
              )}
              {video.views !== undefined && (
                <div className="flex items-center gap-1">
                  <Play className="w-3 h-3" />
                  <span>{formatNumber(video.views)} views</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{formatRelativeTime(video.createdAt)}</span>
            </div>
          </div>

          {/* Tags */}
          {displayTags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {displayTags.slice(0, 3).map((tag, index) => (
                <Badge
                  key={`${tag}-${index}`}
                  variant="secondary"
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                >
                  #{tag}
                </Badge>
              ))}
              {displayTags.length > 3 && (
                <Badge variant="secondary" className="text-xs px-2 py-0.5 rounded-full font-medium">
                  +{displayTags.length - 3}
                </Badge>
              )}
            </div>
          )}

          {/* AI Analysis Warning */}
          {video.aiAnalysis?.status === 'flagged' && video.aiAnalysis.reviewRequired && (
            <div className="mt-3 flex items-center gap-2 p-2 bg-destructive/10 rounded text-xs text-destructive">
              <AlertCircle className="w-4 h-4" />
              <span>Requires manual review</span>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};
