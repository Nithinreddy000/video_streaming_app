const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { HTTP_STATUS } = require('../utils/constants');
const logger = require('../utils/logger');

// Ensure upload directories exist
const uploadDir = process.env.UPLOAD_DIR || './uploads';
const tempDir = process.env.TEMP_DIR || './temp';

[uploadDir, tempDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    logger.info(`Created directory: ${dir}`);
  }
});

// Allowed video MIME types
const ALLOWED_VIDEO_MIMES = [
  'video/mp4',
  'video/mpeg',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
  'video/webm',
  'video/x-flv',
  'video/x-ms-wmv'
];

// Allowed video extensions
const ALLOWED_VIDEO_EXTENSIONS = [
  '.mp4',
  '.mpeg',
  '.mpg',
  '.mov',
  '.avi',
  '.mkv',
  '.webm',
  '.flv',
  '.wmv'
];

/**
 * Configure multer storage
 */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: timestamp-randomstring-originalname
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const ext = path.extname(file.originalname);
    const nameWithoutExt = path.basename(file.originalname, ext);
    const sanitizedName = nameWithoutExt.replace(/[^a-zA-Z0-9-_]/g, '-');
    const filename = `${sanitizedName}-${uniqueSuffix}${ext}`;
    cb(null, filename);
  }
});

/**
 * File filter for video uploads
 */
const videoFileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mimetype = file.mimetype.toLowerCase();

  // Check MIME type
  if (!ALLOWED_VIDEO_MIMES.includes(mimetype)) {
    logger.warn(`Invalid MIME type uploaded: ${mimetype} by user ${req.user?.id}`);
    return cb(new Error(`Invalid file type. Allowed types: ${ALLOWED_VIDEO_MIMES.join(', ')}`), false);
  }

  // Check file extension
  if (!ALLOWED_VIDEO_EXTENSIONS.includes(ext)) {
    logger.warn(`Invalid file extension uploaded: ${ext} by user ${req.user?.id}`);
    return cb(new Error(`Invalid file extension. Allowed extensions: ${ALLOWED_VIDEO_EXTENSIONS.join(', ')}`), false);
  }

  cb(null, true);
};

/**
 * Multer configuration for video uploads
 */
const uploadVideo = multer({
  storage: storage,
  fileFilter: videoFileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 2147483648, // 2GB default
    files: 1
  }
});

/**
 * Middleware to handle single video upload
 */
const uploadSingleVideo = uploadVideo.single('video');

/**
 * Enhanced upload middleware with error handling
 */
const handleVideoUpload = (req, res, next) => {
  uploadSingleVideo(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      // Multer-specific errors
      if (err.code === 'LIMIT_FILE_SIZE') {
        const maxSizeMB = (parseInt(process.env.MAX_FILE_SIZE) || 2147483648) / (1024 * 1024);
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          error: 'File too large',
          message: `File size exceeds ${maxSizeMB}MB limit`
        });
      }

      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          error: 'Unexpected field',
          message: 'Only one video file is allowed'
        });
      }

      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          error: 'Too many files',
          message: 'Only one video file is allowed'
        });
      }

      logger.error('Multer error:', err);
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Upload error',
        message: err.message
      });
    } else if (err) {
      // Other errors (file filter, etc.)
      logger.error('Upload error:', err);
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Upload failed',
        message: err.message
      });
    }

    // No file uploaded
    if (!req.file) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'No file uploaded',
        message: 'Please upload a video file'
      });
    }

    // Attach file info to request
    req.uploadedFile = {
      filename: req.file.filename,
      originalFilename: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      sizeMB: (req.file.size / (1024 * 1024)).toFixed(2),
      path: req.file.path,
      extension: path.extname(req.file.originalname).toLowerCase()
    };

    logger.info(`File uploaded: ${req.file.originalname} (${req.uploadedFile.sizeMB}MB) by user ${req.user?.id}`);

    next();
  });
};

/**
 * Cleanup uploaded file
 */
const cleanupUploadedFile = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      logger.info(`Cleaned up file: ${filePath}`);
    }
  } catch (error) {
    logger.error(`Failed to cleanup file ${filePath}:`, error);
  }
};

/**
 * Middleware to cleanup temp file on error
 */
const cleanupOnError = (err, req, res, next) => {
  if (req.file && req.file.path) {
    cleanupUploadedFile(req.file.path);
  }
  next(err);
};

/**
 * Validate video duration
 */
const validateVideoDuration = async (req, res, next) => {
  try {
    if (!req.file) {
      return next();
    }

    const maxDurationMinutes = parseInt(process.env.MAX_VIDEO_DURATION_MINUTES) || 120;

    // We'll validate duration during processing since it requires FFmpeg
    // For now, just attach the limit to request
    req.maxVideoDuration = maxDurationMinutes * 60; // Convert to seconds

    next();
  } catch (error) {
    logger.error('Video duration validation error:', error);
    next(error);
  }
};

module.exports = {
  handleVideoUpload,
  uploadSingleVideo,
  uploadVideo,
  cleanupUploadedFile,
  cleanupOnError,
  validateVideoDuration,
  ALLOWED_VIDEO_MIMES,
  ALLOWED_VIDEO_EXTENSIONS
};
