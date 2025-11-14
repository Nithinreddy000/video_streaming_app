const express = require('express');
const router = express.Router();
const videoController = require('./video.controller');
const {
  authenticate,
  requireEditor,
  canModerate,
  enforceTenantScope,
  verifyTenantActive,
  checkVideoUploadAllowed
} = require('../../middleware');
const { handleVideoUpload, validateVideoDuration } = require('../../middleware/upload.middleware');

/**
 * @route   POST /api/v1/videos/upload
 * @desc    Upload a new video
 * @access  Private (Editor, Admin)
 */
router.post(
  '/upload',
  authenticate,
  enforceTenantScope,
  verifyTenantActive,
  requireEditor,
  handleVideoUpload,
  validateVideoDuration,
  checkVideoUploadAllowed,
  videoController.uploadVideo
);

/**
 * @route   GET /api/v1/videos
 * @desc    Get all videos for the user's tenant
 * @access  Private
 */
router.get(
  '/',
  authenticate,
  enforceTenantScope,
  videoController.getVideos
);

/**
 * @route   GET /api/v1/videos/:id
 * @desc    Get a single video by ID
 * @access  Private
 */
router.get(
  '/:id',
  authenticate,
  enforceTenantScope,
  videoController.getVideoById
);

/**
 * @route   PATCH /api/v1/videos/:id
 * @desc    Update video metadata
 * @access  Private (Owner, Editor, Admin)
 */
router.patch(
  '/:id',
  authenticate,
  enforceTenantScope,
  videoController.updateVideo
);

/**
 * @route   DELETE /api/v1/videos/:id
 * @desc    Delete a video
 * @access  Private (Owner, Admin)
 */
router.delete(
  '/:id',
  authenticate,
  enforceTenantScope,
  videoController.deleteVideo
);

/**
 * @route   PATCH /api/v1/videos/:id/moderate
 * @desc    Moderate a video (change classification)
 * @access  Private (Editor, Admin)
 */
router.patch(
  '/:id/moderate',
  authenticate,
  enforceTenantScope,
  canModerate,
  videoController.moderateVideo
);

module.exports = router;
