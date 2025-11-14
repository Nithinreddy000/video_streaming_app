const express = require('express');
const router = express.Router();
const streamingController = require('./streaming.controller');
const { authenticate, optionalAuthenticate, enforceTenantScope } = require('../../middleware');

/**
 * @route   GET /api/v1/stream/:videoId
 * @desc    Stream video with range request support
 * @access  Private
 */
router.get(
  '/:videoId',
  authenticate,
  enforceTenantScope,
  streamingController.streamVideo
);

/**
 * @route   GET /api/v1/stream/:videoId/thumbnail
 * @desc    Get video thumbnail
 * @access  Private (optional for public videos)
 */
router.get(
  '/:videoId/thumbnail',
  optionalAuthenticate,
  streamingController.getVideoThumbnail
);

/**
 * @route   GET /api/v1/stream/:videoId/info
 * @desc    Get video stream information
 * @access  Private
 */
router.get(
  '/:videoId/info',
  authenticate,
  enforceTenantScope,
  streamingController.getStreamInfo
);

module.exports = router;
