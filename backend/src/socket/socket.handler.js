const jwt = require('jsonwebtoken');
const { Video } = require('../models');
const logger = require('../utils/logger');

/**
 * Socket.IO Event Handler
 * Manages real-time communication for video processing updates
 */
class SocketHandler {
  constructor(io) {
    this.io = io;
    this.connectedUsers = new Map(); // userId -> socketId mapping
  }

  /**
   * Initialize Socket.IO middleware and event handlers
   */
  initialize() {
    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;

        if (!token) {
          return next(new Error('Authentication token required'));
        }

        // Verify JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.userId = decoded.id;
        // Extract tenantId from tenant field (can be ObjectId string or object)
        socket.tenantId = decoded.tenant?._id || decoded.tenant;
        socket.userRole = decoded.role;

        // Warn if tenantId is missing
        if (!socket.tenantId) {
          logger.warn(`⚠️  Socket authenticated without tenantId: ${socket.id} (User: ${socket.userId})`);
        }

        logger.info(`Socket authenticated: ${socket.id} (User: ${socket.userId}, Tenant: ${socket.tenantId})`);
        next();
      } catch (error) {
        logger.error('Socket authentication failed:', error);
        next(new Error('Authentication failed'));
      }
    });

    // Connection event
    this.io.on('connection', (socket) => {
      this.handleConnection(socket);
    });
  }

  /**
   * Handle new socket connection
   */
  handleConnection(socket) {
    logger.info(`Client connected: ${socket.id} (User: ${socket.userId})`);

    // Track connected user
    this.connectedUsers.set(socket.userId, socket.id);

    // Auto-join user-specific room
    socket.join(`user:${socket.userId}`);
    logger.info(`Socket ${socket.id} joined user room: user:${socket.userId}`);

    // Auto-join tenant room for tenant-wide notifications
    if (socket.tenantId) {
      socket.join(`tenant:${socket.tenantId}`);
      logger.info(`Socket ${socket.id} joined tenant room: tenant:${socket.tenantId}`);
    } else {
      logger.warn(`⚠️  Cannot join tenant room: tenantId is undefined for socket ${socket.id}`);
    }

    // Register event handlers
    socket.on('join-video-room', (data) => this.handleJoinVideoRoom(socket, data));
    socket.on('leave-video-room', (data) => this.handleLeaveVideoRoom(socket, data));
    socket.on('join-tenant-room', (data) => this.handleJoinTenantRoom(socket, data));
    socket.on('disconnect', () => this.handleDisconnect(socket));

    // Send welcome message
    socket.emit('notification', {
      type: 'info',
      message: 'Connected to real-time updates',
    });
  }

  /**
   * Handle joining a video-specific room
   */
  async handleJoinVideoRoom(socket, data) {
    try {
      const { videoId } = data;

      if (!videoId) {
        socket.emit('error', { message: 'videoId is required' });
        return;
      }

      // Verify video exists and user has access
      const video = await Video.findById(videoId);
      if (!video) {
        socket.emit('error', { message: 'Video not found' });
        return;
      }

      // Check tenant access (if both tenantId fields exist)
      if (video.tenantId && socket.tenantId && video.tenantId.toString() !== socket.tenantId) {
        socket.emit('error', { message: 'Access denied' });
        return;
      }

      // Join video room
      const roomName = `video:${videoId}`;
      socket.join(roomName);
      logger.info(`Socket ${socket.id} joined video room: ${roomName}`);

      // Send current video state
      socket.emit('video-state', {
        videoId: video._id,
        status: video.status,
        processingProgress: video.processingProgress,
        aiAnalysis: video.aiAnalysis,
      });
    } catch (error) {
      logger.error('Error joining video room:', error);
      socket.emit('error', { message: 'Failed to join video room' });
    }
  }

  /**
   * Handle leaving a video-specific room
   */
  handleLeaveVideoRoom(socket, data) {
    try {
      const { videoId } = data;

      if (!videoId) {
        return;
      }

      const roomName = `video:${videoId}`;
      socket.leave(roomName);
      logger.info(`Socket ${socket.id} left video room: ${roomName}`);
    } catch (error) {
      logger.error('Error leaving video room:', error);
    }
  }

  /**
   * Handle joining tenant room (manual)
   */
  handleJoinTenantRoom(socket, data) {
    try {
      const { tenantId } = data;

      // Verify tenant access
      if (tenantId !== socket.tenantId) {
        socket.emit('error', { message: 'Access denied' });
        return;
      }

      const roomName = `tenant:${tenantId}`;
      socket.join(roomName);
      logger.info(`Socket ${socket.id} joined tenant room: ${roomName}`);
    } catch (error) {
      logger.error('Error joining tenant room:', error);
    }
  }

  /**
   * Handle client disconnect
   */
  handleDisconnect(socket) {
    logger.info(`Client disconnected: ${socket.id} (User: ${socket.userId})`);
    this.connectedUsers.delete(socket.userId);
  }

  /**
   * Emit processing progress update
   * Emits to multiple rooms for maximum reach regardless of user's current page
   */
  emitProcessingProgress(videoId, progress, stage, userId = null, tenantId = null) {
    const progressData = {
      videoId,
      progress,
      stage,
      timestamp: new Date(),
    };

    // Emit to video room (for users on video detail page)
    this.io.to(`video:${videoId}`).emit('processing-progress', progressData);

    // Emit to user room (for uploader regardless of page)
    if (userId) {
      this.io.to(`user:${userId}`).emit('processing-progress', progressData);
    }

    // Emit to tenant room (for tenant-wide visibility)
    if (tenantId) {
      this.io.to(`tenant:${tenantId}`).emit('processing-progress', progressData);
    }

    logger.info(`Processing progress: ${videoId} - ${progress}% (${stage})`);
  }

  /**
   * Emit processing complete event
   * Emits to multiple rooms for maximum reach regardless of user's current page
   */
  emitProcessingComplete(videoId, video) {
    const completeData = {
      videoId: videoId.toString ? videoId.toString() : videoId,
      video: {
        id: video._id?.toString() || video._id,
        _id: video._id?.toString() || video._id,
        status: video.status,
        processedFiles: video.processedFiles,
        processingProgress: video.processingProgress,
        title: video.title,
      },
      timestamp: new Date(),
    };

    // Emit to video room (for users on video detail page)
    this.io.to(`video:${videoId}`).emit('processing-complete', completeData);

    // Emit to user room (for uploader regardless of page)
    if (video.uploadedBy) {
      this.io.to(`user:${video.uploadedBy}`).emit('processing-complete', completeData);
    }

    // Emit to tenant room (for tenant-wide visibility)
    if (video.tenantId) {
      this.io.to(`tenant:${video.tenantId}`).emit('processing-complete', completeData);

      // Also send notification
      this.io.to(`tenant:${video.tenantId}`).emit('notification', {
        type: 'success',
        message: `Video "${video.title}" is ready to watch!`,
        videoId: video._id,
      });
    }

    logger.info(`Processing complete: ${videoId}`);
  }

  /**
   * Emit processing error event
   */
  emitProcessingError(videoId, error, tenantId) {
    this.io.to(`video:${videoId}`).emit('processing-error', {
      videoId,
      error: error.message || 'Processing failed',
      timestamp: new Date(),
    });

    // Also emit to tenant room
    if (tenantId) {
      this.io.to(`tenant:${tenantId}`).emit('notification', {
        type: 'error',
        message: `Video processing failed: ${error.message}`,
        videoId,
      });
    }

    logger.error(`Processing error: ${videoId} - ${error.message}`);
  }

  /**
   * Emit AI analysis complete event
   */
  emitAIAnalysisComplete(videoId, analysis, tenantId) {
    // Guard against undefined analysis
    if (!analysis) {
      logger.warn(`AI analysis is undefined for video: ${videoId}`);
      return;
    }

    this.io.to(`video:${videoId}`).emit('ai-analysis-complete', {
      videoId,
      analysis,
      timestamp: new Date(),
    });

    // Emit notification if flagged
    if (analysis.status === 'flagged' && tenantId) {
      this.io.to(`tenant:${tenantId}`).emit('notification', {
        type: 'warning',
        message: 'Video flagged for review by AI moderation',
        videoId,
      });
    }

    logger.info(`AI analysis complete: ${videoId} - ${analysis.status}`);
  }

  /**
   * Emit video ready event
   */
  emitVideoReady(videoId, video) {
    this.io.to(`video:${videoId}`).emit('video-ready', {
      videoId,
      video: {
        id: video._id,
        status: video.status,
        processedFiles: video.processedFiles,
      },
      timestamp: new Date(),
    });

    logger.info(`Video ready: ${videoId}`);
  }

  /**
   * Send notification to specific user
   */
  sendUserNotification(userId, notification) {
    const socketId = this.connectedUsers.get(userId);
    if (socketId) {
      this.io.to(socketId).emit('notification', {
        ...notification,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Send notification to all users in tenant
   */
  sendTenantNotification(tenantId, notification) {
    this.io.to(`tenant:${tenantId}`).emit('notification', {
      ...notification,
      timestamp: new Date(),
    });
  }

  /**
   * Get connected users count
   */
  getConnectedUsersCount() {
    return this.connectedUsers.size;
  }

  /**
   * Check if user is connected
   */
  isUserConnected(userId) {
    return this.connectedUsers.has(userId);
  }
}

module.exports = SocketHandler;
