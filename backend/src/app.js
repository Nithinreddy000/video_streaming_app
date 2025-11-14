const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const logger = require('./utils/logger');
const { HTTP_STATUS } = require('./utils/constants');

// Create Express app
const app = express();

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Compression middleware
app.use(compression());

// HTTP request logger
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', {
    stream: {
      write: (message) => logger.info(message.trim())
    }
  }));
}

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/', limiter);

// Attach Socket.IO to request object (will be set in server.js)
app.use((req, res, next) => {
  req.io = req.app.get('io');
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(HTTP_STATUS.OK).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

// API routes
app.use(`/api/${process.env.API_VERSION || 'v1'}/auth`, require('./modules/auth/auth.routes'));
app.use(`/api/${process.env.API_VERSION || 'v1'}/videos`, require('./modules/videos/video.routes'));
app.use(`/api/${process.env.API_VERSION || 'v1'}/stream`, require('./modules/streaming/streaming.routes'));
app.use(`/api/${process.env.API_VERSION || 'v1'}/tenants`, require('./modules/tenants/tenant.routes'));
app.use(`/api/${process.env.API_VERSION || 'v1'}/admin`, require('./modules/admin/admin.routes'));
app.use(`/api/${process.env.API_VERSION || 'v1'}/admin/invitations`, require('./modules/admin/invitation.routes'));
app.use(`/api/${process.env.API_VERSION || 'v1'}/invitations`, require('./modules/invitations/invitation-public.routes'));

// Streaming URLs endpoint (for HLS/DASH URLs)
const streamingController = require('./modules/streaming/streaming.controller');
const { authenticate, enforceTenantScope } = require('./middleware');
app.get(
  `/api/${process.env.API_VERSION || 'v1'}/streaming/:videoId`,
  authenticate,
  enforceTenantScope,
  streamingController.getStreamingUrls
);

// TODO: Add more routes as they are implemented
// app.use(`/api/${process.env.API_VERSION || 'v1'}/analytics`, require('./modules/analytics/analytics.routes'));

// 404 handler
app.use((req, res) => {
  res.status(HTTP_STATUS.NOT_FOUND).json({
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method
  });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      error: 'Validation Error',
      details: Object.values(err.errors).map(e => e.message)
    });
  }

  // Mongoose cast error
  if (err.name === 'CastError') {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      error: 'Invalid ID format'
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({
      error: 'Invalid token'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({
      error: 'Token expired'
    });
  }

  // Multer file upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      error: 'File too large',
      maxSize: process.env.MAX_FILE_SIZE
    });
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      error: 'Unexpected field in file upload'
    });
  }

  // Default error response
  const statusCode = err.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
  res.status(statusCode).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

module.exports = app;
