const socketIO = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const SocketHandler = require('../socket/socket.handler');
const logger = require('../utils/logger');

let io = null;
let socketHandler = null;

const initializeSocketIO = (server, redisClient) => {
  io = socketIO(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000
  });

  // Redis adapter for horizontal scaling (optional)
  if (redisClient) {
    try {
      const pubClient = redisClient.duplicate();
      const subClient = redisClient.duplicate();
      
      // Wait for clients to be ready before setting up adapter
      pubClient.on('ready', () => {
        subClient.on('ready', () => {
          try {
            io.adapter(createAdapter(pubClient, subClient));
            logger.info('✅ Socket.IO Redis adapter configured');
          } catch (adapterError) {
            logger.warn('Socket.IO Redis adapter setup failed, using default adapter:', adapterError.message);
          }
        });
      });

      // If Redis clients fail to connect, just use default adapter
      pubClient.on('error', (error) => {
        logger.warn('Socket.IO Redis pub client error, using default adapter:', error.message);
      });
      
      subClient.on('error', (error) => {
        logger.warn('Socket.IO Redis sub client error, using default adapter:', error.message);
      });
    } catch (error) {
      logger.warn('Socket.IO Redis adapter setup failed, using default adapter:', error.message);
    }
  }

  // Initialize Socket Handler
  socketHandler = new SocketHandler(io);
  socketHandler.initialize();

  logger.info('Socket.IO initialized with SocketHandler');
  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO not initialized. Call initializeSocketIO first.');
  }
  return io;
};

const getSocketHandler = () => {
  if (!socketHandler) {
    throw new Error('SocketHandler not initialized. Call initializeSocketIO first.');
  }
  return socketHandler;
};

// Emit events to specific rooms (legacy support)
const emitToVideo = (videoId, event, data) => {
  if (io) {
    io.to(`video:${videoId}`).emit(event, data);
  }
};

const emitToUser = (userId, event, data) => {
  if (socketHandler) {
    socketHandler.sendUserNotification(userId, { type: 'info', message: data });
  }
};

const emitToTenant = (tenantId, event, data) => {
  if (socketHandler) {
    socketHandler.sendTenantNotification(tenantId, { type: 'info', message: data });
  }
};

// Enhanced emit methods using SocketHandler
const emitProcessingProgress = (videoId, progress, stage, userId = null, tenantId = null) => {
  if (socketHandler) {
    socketHandler.emitProcessingProgress(videoId, progress, stage, userId, tenantId);
  }
};

const emitProcessingComplete = (videoId, video) => {
  if (socketHandler) {
    socketHandler.emitProcessingComplete(videoId, video);
  }
};

const emitProcessingError = (videoId, error, tenantId) => {
  if (socketHandler) {
    socketHandler.emitProcessingError(videoId, error, tenantId);
  }
};

const emitAIAnalysisComplete = (videoId, analysis, tenantId) => {
  if (socketHandler) {
    socketHandler.emitAIAnalysisComplete(videoId, analysis, tenantId);
  }
};

const emitVideoReady = (videoId, video) => {
  if (socketHandler) {
    socketHandler.emitVideoReady(videoId, video);
  }
};

module.exports = {
  initializeSocketIO,
  getIO,
  getSocketHandler,
  emitToVideo,
  emitToUser,
  emitToTenant,
  emitProcessingProgress,
  emitProcessingComplete,
  emitProcessingError,
  emitAIAnalysisComplete,
  emitVideoReady
};
