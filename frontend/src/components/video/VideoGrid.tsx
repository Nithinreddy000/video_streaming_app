import { motion } from 'framer-motion';
import { Loader2, FileVideo } from 'lucide-react';
import { VideoCard } from './VideoCard';
import type { Video } from '@types/index';

interface VideoGridProps {
  videos: Video[];
  isLoading?: boolean;
  emptyMessage?: string;
  onVideoClick?: (video: Video) => void;
}

export const VideoGrid: React.FC<VideoGridProps> = ({
  videos,
  isLoading = false,
  emptyMessage = 'No videos found',
  onVideoClick,
}) => {
  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading videos...</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (videos.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-center py-20"
      >
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
            <FileVideo className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-lg font-medium text-foreground mb-2">No Videos</p>
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        </div>
      </motion.div>
    );
  }

  // Grid layout
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {videos.map((video, index) => (
        <motion.div
          key={video.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
        >
          <VideoCard
            video={video}
            onClick={() => onVideoClick?.(video)}
          />
        </motion.div>
      ))}
    </div>
  );
};
