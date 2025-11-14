const { Video, ProcessingJob } = require('../../models');
const azureBlobService = require('../../services/azure-blob.service');
const cdnService = require('../../services/cdn.service');
const serviceBusService = require('../../services/servicebus.service');
const { HTTP_STATUS } = require('../../utils/constants');
const logger = require('../../utils/logger');
const path = require('path');
const fs = require('fs');

/**
 * Upload a new video
 * POST /api/v1/videos/upload
 */
const uploadVideo = async (req, res) => {
  let uploadedFilePath = null;

  try {
    const { title, description, tags, category, isPublic, accessControl } = req.body;
    const uploadedFile = req.uploadedFile || req.file;

    if (!uploadedFile) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'No file uploaded',
        message: 'Please upload a video file'
      });
    }

    uploadedFilePath = uploadedFile.path;

    // Parse accessControl if it's a string (from FormData)
    let parsedAccessControl = accessControl;
    if (typeof accessControl === 'string') {
      try {
        parsedAccessControl = JSON.parse(accessControl);
      } catch (e) {
        logger.warn('Failed to parse accessControl:', e);
        parsedAccessControl = null;
      }
    }

    // Parse tags if it's a string (from FormData)
    let parsedTags = tags;
    if (typeof tags === 'string') {
      try {
        // Try to parse as JSON first (e.g., '["tag1","tag2"]')
        parsedTags = JSON.parse(tags);
      } catch (e) {
        // If JSON parse fails, treat as comma-separated string
        parsedTags = tags.split(',').map(t => t.trim());
      }
    }

    // Create video record in database
    const video = await Video.create({
      title: title || path.parse(uploadedFile.originalFilename).name,
      description: description || '',
      filename: uploadedFile.filename,
      originalFilename: uploadedFile.originalFilename,
      mimeType: uploadedFile.mimeType,
      fileSize: uploadedFile.size,
      blobUrl: '', // Will be updated after blob upload
      status: 'uploading',
      uploadedBy: req.userId,
      tenant: req.tenantId,
      tags: parsedTags && Array.isArray(parsedTags) ? parsedTags : [],
      category: category || '',
      isPublic: isPublic === 'true' || isPublic === true,
      accessControl: parsedAccessControl ? {
        isPublic: parsedAccessControl.isPublic || false,
        organization: parsedAccessControl.organization || req.tenantId,
        allowedRoles: parsedAccessControl.allowedRoles || ['viewer', 'editor', 'admin']
      } : {
        isPublic: false,
        organization: req.tenantId,
        allowedRoles: ['viewer', 'editor', 'admin']
      }
    });

    logger.info(`Video record created: ${video._id} for user ${req.userId}`);

    // Upload to Azure Blob Storage
    const blobName = `videos/${req.tenantId}/${video._id}/${uploadedFile.filename}`;
    const uploadResult = await azureBlobService.uploadFile(uploadedFilePath, blobName);

    // Update video with blob URL - extract the actual URL string from the result object
    video.blobUrl = uploadResult.blobUrl;
    video.cdnUrl = uploadResult.cdnUrl || cdnService.getCDNUrl(blobName);
    await video.save();

    logger.info(`Video uploaded to blob storage: ${uploadResult.blobUrl}`);

    // Create processing job
    const processingJob = await ProcessingJob.create({
      video: video._id,
      tenant: req.tenantId,
      type: 'upload',
      status: 'pending',
      priority: 5
    });

    // Send message to Service Bus for processing
    await serviceBusService.publishVideoUpload({
      videoId: video._id.toString(),
      tenantId: req.tenantId.toString(),
      blobUrl: video.blobUrl,
      fileName: uploadedFile.originalFilename,
      fileSize: uploadedFile.size,
      metadata: {
        userId: req.userId.toString(),
        jobId: processingJob._id.toString(),
        filename: uploadedFile.filename,
        mimeType: uploadedFile.mimeType
      }
    });

    logger.info(`Processing job created and queued: ${processingJob._id}`);

    // Clean up temporary file
    if (fs.existsSync(uploadedFilePath)) {
      fs.unlinkSync(uploadedFilePath);
      logger.info(`Cleaned up temp file: ${uploadedFilePath}`);
    }

    // Emit Socket.io event for real-time update
    if (req.io) {
      req.io.to(`user:${req.userId}`).emit('video:upload:started', {
        videoId: video._id,
        title: video.title,
        status: 'processing'
      });
    }

    // Return response
    res.status(HTTP_STATUS.CREATED).json({
      message: 'Video uploaded successfully',
      video: {
        id: video._id.toString(),
        title: video.title,
        description: video.description,
        filename: video.filename,
        status: video.status,
        blobUrl: video.blobUrl,
        cdnUrl: video.cdnUrl,
        createdAt: video.createdAt
      },
      processingJob: {
        id: processingJob._id,
        status: processingJob.status
      }
    });
  } catch (error) {
    logger.error('Video upload error:', error);

    // Clean up temporary file on error
    if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
      try {
        fs.unlinkSync(uploadedFilePath);
      } catch (cleanupError) {
        logger.error('Failed to cleanup temp file:', cleanupError);
      }
    }

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: 'Upload failed',
      message: 'An error occurred while uploading the video'
    });
  }
};

/**
 * Get all videos for the authenticated user's tenant
 * GET /api/v1/videos
 */
const getVideos = async (req, res) => {
  try {
    const {
      status,
      classification,
      category,
      search,
      tags,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      limit = 20
    } = req.query;

    const filters = { tenant: req.tenantId };

    // Access control filtering - user can see:
    // 1. Public videos (accessControl.isPublic = true or legacy isPublic = true)
    // 2. Videos they uploaded
    // 3. Videos where their organization and role match access control
    filters.$or = [
      { 'accessControl.isPublic': true },
      { isPublic: true }, // Legacy support
      { uploadedBy: req.userId },
      {
        $and: [
          { 'accessControl.organization': req.tenantId },
          { 'accessControl.allowedRoles': { $in: [req.user.role] } }
        ]
      }
    ];

    // Apply additional filters
    if (status) filters.status = status;
    if (classification) filters.classification = classification;
    if (category) filters.category = category;
    if (search) filters.$text = { $search: search };
    if (tags) filters.tags = { $in: tags.split(',').map(t => t.trim()) };

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query
    const [videos, total] = await Promise.all([
      Video.find(filters)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .populate('uploadedBy', 'username email')
        .populate('accessControl.organization', 'name slug'),
      Video.countDocuments(filters)
    ]);

    res.status(HTTP_STATUS.OK).json({
      videos,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Get videos error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: 'Failed to fetch videos',
      message: 'An error occurred while fetching videos'
    });
  }
};

/**
 * Get a single video by ID
 * GET /api/v1/videos/:id
 */
const getVideoById = async (req, res) => {
  try {
    const { id } = req.params;

    const video = await Video.findOne({
      _id: id,
      tenant: req.tenantId
    })
      .populate('uploadedBy', 'username email')
      .populate('moderatedBy', 'username email')
      .populate('accessControl.organization', 'name slug');

    if (!video) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Video not found',
        message: 'The requested video does not exist'
      });
    }

    // Check access permissions based on access control
    const hasAccess = (
      video.accessControl?.isPublic === true ||
      video.isPublic === true || // Legacy support
      video.uploadedBy._id.toString() === req.userId.toString() ||
      (
        video.accessControl?.organization?.toString() === req.tenantId.toString() &&
        video.accessControl?.allowedRoles?.includes(req.user.role)
      )
    );

    if (!hasAccess) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        error: 'Access denied',
        message: 'You do not have permission to access this video'
      });
    }

    res.status(HTTP_STATUS.OK).json({ video });
  } catch (error) {
    logger.error('Get video by ID error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: 'Failed to fetch video',
      message: 'An error occurred while fetching the video'
    });
  }
};

/**
 * Update video metadata
 * PATCH /api/v1/videos/:id
 */
const updateVideo = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, tags, category, isPublic, accessControl } = req.body;

    const video = await Video.findOne({
      _id: id,
      tenant: req.tenantId
    });

    if (!video) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Video not found',
        message: 'The requested video does not exist'
      });
    }

    // Check permissions - only uploader or admin can update
    // Editors can only edit their own videos, not others'
    const isOwner = video.uploadedBy.toString() === req.userId.toString();
    const isAdmin = req.user.role === 'admin';
    const canUpdate = isOwner || isAdmin;

    if (!canUpdate) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        error: 'Access denied',
        message: 'You do not have permission to update this video. Only the uploader or admin can edit videos.'
      });
    }

    // Update fields
    if (title !== undefined) video.title = title;
    if (description !== undefined) video.description = description;
    if (tags !== undefined) {
      // Parse tags if string (could be JSON or comma-separated)
      let parsedTags = tags;
      if (typeof tags === 'string') {
        try {
          parsedTags = JSON.parse(tags);
        } catch (e) {
          parsedTags = tags.split(',').map(t => t.trim());
        }
      }
      video.tags = Array.isArray(parsedTags) ? parsedTags : [];
    }
    if (category !== undefined) video.category = category;
    if (isPublic !== undefined) video.isPublic = isPublic;

    // Update access control
    if (accessControl !== undefined) {
      video.accessControl = {
        isPublic: accessControl.isPublic || false,
        organization: accessControl.organization || req.tenantId,
        allowedRoles: accessControl.allowedRoles || ['viewer', 'editor', 'admin']
      };
    }

    await video.save();

    logger.info(`Video updated: ${video._id} by user ${req.userId}`);

    res.status(HTTP_STATUS.OK).json({
      message: 'Video updated successfully',
      video
    });
  } catch (error) {
    logger.error('Update video error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: 'Update failed',
      message: 'An error occurred while updating the video'
    });
  }
};

/**
 * Delete a video
 * DELETE /api/v1/videos/:id
 */
const deleteVideo = async (req, res) => {
  try {
    const { id } = req.params;

    const video = await Video.findOne({
      _id: id,
      tenant: req.tenantId
    });

    if (!video) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Video not found',
        message: 'The requested video does not exist'
      });
    }

    // Check permissions
    if (req.user.role !== 'admin' && video.uploadedBy.toString() !== req.userId.toString()) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        error: 'Access denied',
        message: 'You do not have permission to delete this video'
      });
    }

    // Delete from Azure Blob Storage
    try {
      await azureBlobService.deleteFile(video.blobUrl);
      logger.info(`Deleted blob: ${video.blobUrl}`);
    } catch (blobError) {
      logger.error('Failed to delete blob:', blobError);
      // Continue with database deletion even if blob deletion fails
    }

    // Delete processing jobs
    await ProcessingJob.deleteMany({ video: video._id });

    // Delete video record
    await video.deleteOne();

    // Update tenant storage usage
    if (req.tenant) {
      const videoSizeMB = video.fileSize / (1024 * 1024);
      await req.tenant.updateStorageUsage(videoSizeMB, false);
    }

    logger.info(`Video deleted: ${id} by user ${req.userId}`);

    // Emit Socket.io event
    if (req.io) {
      req.io.to(`user:${req.userId}`).emit('video:deleted', {
        videoId: id
      });
    }

    res.status(HTTP_STATUS.OK).json({
      message: 'Video deleted successfully'
    });
  } catch (error) {
    logger.error('Delete video error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: 'Delete failed',
      message: 'An error occurred while deleting the video'
    });
  }
};

/**
 * Moderate a video (admin/editor only)
 * PATCH /api/v1/videos/:id/moderate
 */
const moderateVideo = async (req, res) => {
  try {
    const { id } = req.params;
    const { classification, moderationNotes } = req.body;

    if (!classification || !['safe', 'flagged', 'reviewing'].includes(classification)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Invalid classification',
        message: 'Classification must be one of: safe, flagged, reviewing'
      });
    }

    const video = await Video.findOne({
      _id: id,
      tenant: req.tenantId
    });

    if (!video) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Video not found',
        message: 'The requested video does not exist'
      });
    }

    // Update moderation fields
    video.classification = classification;
    video.moderationNotes = moderationNotes || '';
    video.moderatedBy = req.userId;
    video.moderatedAt = new Date();

    await video.save();

    logger.info(`Video moderated: ${video._id} as ${classification} by user ${req.userId}`);

    // Emit Socket.io event
    if (req.io) {
      req.io.to(`user:${video.uploadedBy}`).emit('video:moderated', {
        videoId: video._id,
        classification,
        moderationNotes
      });
    }

    res.status(HTTP_STATUS.OK).json({
      message: 'Video moderated successfully',
      video
    });
  } catch (error) {
    logger.error('Moderate video error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: 'Moderation failed',
      message: 'An error occurred while moderating the video'
    });
  }
};

module.exports = {
  uploadVideo,
  getVideos,
  getVideoById,
  updateVideo,
  deleteVideo,
  moderateVideo
};
