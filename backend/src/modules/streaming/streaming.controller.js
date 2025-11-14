const { Video } = require('../../models');
const azureBlobService = require('../../services/azure-blob.service');
const cdnService = require('../../services/cdn.service');
const { HTTP_STATUS } = require('../../utils/constants');
const logger = require('../../utils/logger');

/**
 * Stream video with HTTP range request support
 * GET /api/v1/stream/:videoId
 */
const streamVideo = async (req, res) => {
  try {
    const { videoId } = req.params;
    const range = req.headers.range;

    // Find video
    const video = await Video.findOne({
      _id: videoId,
      tenant: req.tenantId
    });

    if (!video) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Video not found',
        message: 'The requested video does not exist'
      });
    }

    // Check if video is ready for streaming
    if (video.status !== 'ready') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Video not ready',
        message: `Video is currently ${video.status}. Please wait for processing to complete.`,
        status: video.status,
        progress: video.processingProgress
      });
    }

    // Check access permissions
    if (req.user.role !== 'admin' && !video.isPublic && video.uploadedBy.toString() !== req.userId.toString()) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        error: 'Access denied',
        message: 'You do not have permission to view this video'
      });
    }

    // Increment view count
    await video.incrementViewCount();

    // Update tenant stream count
    if (req.tenant) {
      await req.tenant.incrementStreamCount();
    }

    // Use CDN URL if available
    if (video.cdnUrl && process.env.CDN_ENABLED === 'true') {
      // Redirect to CDN
      return res.redirect(video.cdnUrl);
    }

    // Stream from Azure Blob Storage with range support
    const videoSize = video.fileSize;

    if (!range) {
      // No range header - stream entire video
      res.writeHead(HTTP_STATUS.OK, {
        'Content-Length': videoSize,
        'Content-Type': video.mimeType || 'video/mp4',
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600',
        'X-Video-Id': video._id.toString()
      });

      try {
        const stream = await azureBlobService.getFileStream(video.blobUrl);
        stream.pipe(res);
      } catch (error) {
        logger.error('Streaming error:', error);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
          error: 'Streaming failed',
          message: 'Failed to stream video'
        });
      }
    } else {
      // Parse range header
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : videoSize - 1;
      const chunkSize = (end - start) + 1;

      // Validate range
      if (start >= videoSize || end >= videoSize) {
        res.writeHead(416, {
          'Content-Range': `bytes */${videoSize}`
        });
        return res.end();
      }

      // Send partial content
      res.writeHead(HTTP_STATUS.PARTIAL_CONTENT, {
        'Content-Range': `bytes ${start}-${end}/${videoSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': video.mimeType || 'video/mp4',
        'Cache-Control': 'public, max-age=3600',
        'X-Video-Id': video._id.toString()
      });

      try {
        const stream = await azureBlobService.getFileStream(video.blobUrl, start, end);
        stream.pipe(res);
      } catch (error) {
        logger.error('Range streaming error:', error);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
          error: 'Streaming failed',
          message: 'Failed to stream video range'
        });
      }
    }

    logger.info(`Video streamed: ${videoId} to user ${req.userId} ${range ? `(range: ${range})` : '(full)'}`);
  } catch (error) {
    logger.error('Stream video error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: 'Streaming failed',
      message: 'An error occurred while streaming the video'
    });
  }
};

/**
 * Get video thumbnail
 * GET /api/v1/stream/:videoId/thumbnail
 */
const getVideoThumbnail = async (req, res) => {
  try {
    const { videoId } = req.params;

    const video = await Video.findOne({
      _id: videoId,
      tenant: req.tenantId
    });

    if (!video) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Video not found',
        message: 'The requested video does not exist'
      });
    }

    if (!video.thumbnailUrl) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Thumbnail not found',
        message: 'Thumbnail has not been generated yet'
      });
    }

    // Redirect to thumbnail URL (CDN or blob)
    res.redirect(video.thumbnailUrl);
  } catch (error) {
    logger.error('Get thumbnail error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: 'Failed to get thumbnail',
      message: 'An error occurred while fetching the thumbnail'
    });
  }
};

/**
 * Get video stream info (without actually streaming)
 * GET /api/v1/stream/:videoId/info
 */
const getStreamInfo = async (req, res) => {
  try {
    const { videoId } = req.params;

    const video = await Video.findOne({
      _id: videoId,
      tenant: req.tenantId
    }).select('title duration resolution codec bitrate fps status mimeType fileSize cdnUrl');

    if (!video) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Video not found',
        message: 'The requested video does not exist'
      });
    }

    // Check access permissions
    if (req.user.role !== 'admin' && !video.isPublic && video.uploadedBy.toString() !== req.userId.toString()) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        error: 'Access denied',
        message: 'You do not have permission to access this video'
      });
    }

    const streamInfo = {
      videoId: video._id,
      title: video.title,
      duration: video.duration,
      resolution: video.resolution,
      codec: video.codec,
      bitrate: video.bitrate,
      fps: video.fps,
      mimeType: video.mimeType,
      fileSize: video.fileSize,
      status: video.status,
      streamUrl: video.cdnUrl || `/api/v1/stream/${video._id}`,
      supportsRangeRequests: true
    };

    res.status(HTTP_STATUS.OK).json(streamInfo);
  } catch (error) {
    logger.error('Get stream info error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: 'Failed to get stream info',
      message: 'An error occurred while fetching stream information'
    });
  }
};

/**
 * Get streaming URLs for HLS/DASH playback
 * GET /api/v1/streaming/:videoId
 */
const getStreamingUrls = async (req, res) => {
  try {
    const { videoId } = req.params;

    // Find video
    const video = await Video.findOne({
      _id: videoId,
      tenant: req.tenantId
    });

    if (!video) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Video not found',
        message: 'The requested video does not exist'
      });
    }

    // Check if video is ready
    if (video.status !== 'ready') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Video not ready',
        message: `Video is currently ${video.status}. Please wait for processing to complete.`,
        status: video.status,
        progress: video.processingProgress
      });
    }

    // Check access permissions
    if (req.user.role !== 'admin' && !video.isPublic && video.uploadedBy.toString() !== req.userId.toString()) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        error: 'Access denied',
        message: 'You do not have permission to access this video'
      });
    }

    // Build response with streaming URLs
    const response = {
      hlsUrl: video.processedFiles?.hls || null,
      mp4Url: video.cdnUrl, // Direct MP4 URL for fallback playback
      dashUrl: video.processedFiles?.dash,
      mp4Urls: video.processedFiles?.mp4 ? Object.fromEntries(video.processedFiles.mp4) : null,
      thumbnailUrl: video.processedFiles?.thumbnail || video.thumbnailUrl,
      posterUrl: video.processedFiles?.poster,
      qualities: video.processedFiles?.qualities || [],
      fallbackToMp4: !video.processedFiles?.hls && !!video.cdnUrl, // Indicates if MP4 fallback should be used
      directStreamUrl: `/api/${process.env.API_VERSION || 'v1'}/stream/${video._id}`
    };

    logger.info(`Streaming URLs provided for video: ${videoId} to user: ${req.userId}`);

    res.status(HTTP_STATUS.OK).json(response);
  } catch (error) {
    logger.error('Get streaming URLs error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: 'Failed to get streaming URLs',
      message: 'An error occurred while fetching streaming URLs'
    });
  }
};

module.exports = {
  streamVideo,
  getVideoThumbnail,
  getStreamInfo,
  getStreamingUrls
};
