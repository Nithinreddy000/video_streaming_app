const { getQueueReceiver, QUEUE_NAMES } = require('../../config/servicebus');
const serviceBusService = require('../../services/servicebus.service');
const logger = require('../../utils/logger');
const { emitProcessingProgress, emitProcessingComplete } = require('../../config/socket');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs').promises;
const azureBlobService = require('../../services/azure-blob.service');

// Configure ffmpeg/ffprobe executable paths from environment, if provided
try {
  if (process.env.FFMPEG_PATH) {
    ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
  }
  if (process.env.FFPROBE_PATH) {
    ffmpeg.setFfprobePath(process.env.FFPROBE_PATH);
  }
} catch (e) {
  // Ignore configuration errors; worker will log runtime errors if binaries are missing
}

// Lazy load Video model to avoid Mongoose model compilation issues
let Video = null;
const getVideoModel = () => {
  if (!Video) {
    Video = require('../../models/video.model');
  }
  return Video;
};

/**
 * Transcoding Queue Worker
 *
 * Processes video transcoding jobs from Azure Service Bus.
 * Handles FFmpeg transcoding, HLS generation, and thumbnail extraction.
 */

class TranscodingWorker {
  constructor() {
    this.receiver = null;
    this.isRunning = false;
  }

  /**
   * Start the worker
   */
  async start() {
    try {
      this.receiver = getQueueReceiver(QUEUE_NAMES.VIDEO_TRANSCODING, {
        receiveMode: 'peekLock',
        maxAutoLockRenewalDuration: 600000 // 10 minutes (long for video processing)
      });

      this.isRunning = true;
      logger.info('✅ Transcoding Worker started');

      // Set up message handler
      this.receiver.subscribe({
        processMessage: this.processMessage.bind(this),
        processError: this.processError.bind(this)
      });
    } catch (error) {
      logger.error('❌ Failed to start Transcoding Worker:', error);
      throw error;
    }
  }

  /**
   * Stop the worker
   */
  async stop() {
    try {
      if (this.receiver) {
        await this.receiver.close();
        this.isRunning = false;
        logger.info('✅ Transcoding Worker stopped');
      }
    } catch (error) {
      logger.error('❌ Error stopping Transcoding Worker:', error);
    }
  }

  /**
   * Process a single message
   * @param {ServiceBusReceivedMessage} message - Service Bus message
   */
  async processMessage(message) {
    const startTime = Date.now();
    const messageBody = message.body;
    const { videoId, tenantId, inputUrl, outputPath, settings } = messageBody;

    logger.info(`📥 Processing transcoding job: ${videoId}`);

    let userId = null;  // Declare outside try block so it's accessible in catch block

    try {
      // Fetch video to get uploader ID for socket emissions
      const video = await getVideoModel().findById(videoId);
      if (!video) {
        throw new Error(`Video not found: ${videoId}`);
      }
      userId = video.uploader?.toString();

      // Update video status
      await getVideoModel().findByIdAndUpdate(videoId, {
        status: 'processing',
        processingStartedAt: new Date()
      });

      emitProcessingProgress(videoId, 20, 'transcoding', userId, tenantId);

      // Download video from blob
      const localInputPath = path.join(__dirname, '../../../temp', `${videoId}_input.mp4`);
      await azureBlobService.downloadFromBlob(inputUrl, localInputPath);

      // Validate downloaded file before FFmpeg processing
      try {
        const stats = await fs.stat(localInputPath);

        if (!stats || stats.size === 0) {
          throw new Error(`Downloaded file is empty or invalid: ${localInputPath}`);
        }

        // Verify file is readable
        await fs.access(localInputPath, fs.constants.R_OK);

        logger.info(`✅ Downloaded video file validated: ${stats.size} bytes (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
      } catch (validateError) {
        logger.error(`❌ File validation failed for ${videoId}:`, validateError);
        throw new Error(`File validation failed: ${validateError.message}`);
      }

      emitProcessingProgress(videoId, 30, 'transcoding', userId, tenantId);

      // Create output directory
      const localOutputDir = path.join(__dirname, '../../../temp', `${videoId}_output`);
      await fs.mkdir(localOutputDir, { recursive: true });

      // Transcode to multiple resolutions
      const transcodedFiles = await this.transcodeVideo(
        localInputPath,
        localOutputDir,
        videoId,
        settings
      );

      emitProcessingProgress(videoId, 60, 'uploading', userId, tenantId);

      // Upload transcoded files to blob storage
      const uploadedFiles = await this.uploadTranscodedFiles(
        transcodedFiles,
        outputPath,
        videoId
      );

      emitProcessingProgress(videoId, 80, 'finalizing', userId, tenantId);

      // Update video record with processed files
      await getVideoModel().findByIdAndUpdate(videoId, {
        status: 'ready',
        processedFiles: uploadedFiles,
        processingCompletedAt: new Date(),
        duration: transcodedFiles.duration
      });

      // Publish AI analysis request
      await serviceBusService.publishAIAnalysisRequest({
        videoId,
        tenantId,
        videoUrl: uploadedFiles.mp4['720p'] || uploadedFiles.mp4['1080p'] || uploadedFiles.mp4['480p']
      });

      // Publish processing event
      await serviceBusService.publishProcessingEvent({
        eventType: 'completed',
        videoId,
        tenantId,
        stage: 'transcoding',
        progress: 100,
        metadata: { duration: transcodedFiles.duration }
      });

      // Clean up temp files
      await this.cleanup(localInputPath, localOutputDir);

      // Complete the message
      await this.receiver.completeMessage(message);

      const processingTime = Date.now() - startTime;
      logger.info(`✅ Transcoding completed: ${videoId} (${processingTime}ms)`);

      // Emit final progress update
      emitProcessingProgress(videoId, 100, 'ready', userId, tenantId);

      // Fetch updated video to emit processing complete event
      const completedVideo = await getVideoModel().findById(videoId);
      emitProcessingComplete(videoId, completedVideo);
    } catch (error) {
      logger.error(`❌ Error processing transcoding job: ${videoId}`, error);
      // Update video status
      try {
        await getVideoModel().findByIdAndUpdate(videoId, {
          status: 'failed',
          error: error.message,
          failedAt: new Date()
        });

        emitProcessingProgress(videoId, 0, 'failed', userId, tenantId);

        // Publish processing event
        await serviceBusService.publishProcessingEvent({
          eventType: 'failed',
          videoId,
          tenantId,
          stage: 'transcoding',
          progress: 0,
          metadata: { error: error.message }
        });
      } catch (updateError) {
        logger.error(`❌ Failed to update video status: ${videoId}`, updateError);
      }

      // Dead-letter if retry exceeded
      if (message.deliveryCount > 2) {
        logger.warn(`⚠️ Moving message to dead-letter queue: ${videoId}`);
        await this.receiver.deadLetterMessage(message, {
          deadLetterReason: 'MaxDeliveryCountExceeded',
          deadLetterErrorDescription: error.message
        });
      } else {
        await this.receiver.abandonMessage(message);
      }
    }
  }

  /**
   * Transcode video to multiple formats and resolutions
   * @param {string} inputPath - Input video path
   * @param {string} outputDir - Output directory
   * @param {string} videoId - Video ID
   * @param {object} settings - Transcoding settings
   * @returns {object} Transcoded file paths
   */
  async transcodeVideo(inputPath, outputDir, videoId, settings) {
    return new Promise((resolve, reject) => {
      const files = {
        hls: null,
        mp4: {},
        thumbnail: null,
        duration: 0
      };

      // Get video metadata first
      ffmpeg.ffprobe(inputPath, async (err, metadata) => {
        if (err) return reject(err);

        files.duration = metadata.format.duration;

        try {
          // Generate HLS
          const hlsPath = path.join(outputDir, 'hls', 'master.m3u8');
          await fs.mkdir(path.join(outputDir, 'hls'), { recursive: true });

          await new Promise((res, rej) => {
            ffmpeg(inputPath)
              .outputOptions([
                '-c:v h264',
                '-c:a aac',
                '-hls_time 10',
                '-hls_list_size 0',
                '-f hls'
              ])
              .output(hlsPath)
              .on('end', () => {
                files.hls = hlsPath;
                res();
              })
              .on('error', rej)
              .run();
          });

          // Generate MP4 variants
          for (const resolution of settings.resolutions || ['720p', '480p']) {
            const mp4Path = path.join(outputDir, `${resolution}.mp4`);
            await new Promise((res, rej) => {
              ffmpeg(inputPath)
                .size(this.getResolution(resolution))
                .videoBitrate('1000k')
                .audioBitrate('128k')
                .output(mp4Path)
                .on('end', () => {
                  files.mp4[resolution] = mp4Path;
                  res();
                })
                .on('error', rej)
                .run();
            });
          }

          // Generate thumbnail
          const thumbnailPath = path.join(outputDir, 'thumbnail.jpg');
          await new Promise((res, rej) => {
            ffmpeg(inputPath)
              .screenshots({
                count: 1,
                folder: outputDir,
                filename: 'thumbnail.jpg',
                size: '1280x720'
              })
              .on('end', () => {
                files.thumbnail = thumbnailPath;
                res();
              })
              .on('error', rej);
          });

          resolve(files);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  /**
   * Upload transcoded files to blob storage
   * @param {object} files - Local file paths
   * @param {string} outputPath - Blob output path
   * @param {string} videoId - Video ID
   * @returns {object} Uploaded file URLs
   */
  async uploadTranscodedFiles(files, outputPath, videoId) {
    const uploadedFiles = {
      hls: null,
      mp4: {},
      thumbnail: null
    };

    // Upload HLS files
    if (files.hls) {
      const hlsDir = path.dirname(files.hls);
      const hlsFiles = await fs.readdir(hlsDir);
      let hlsMasterUrl = null;

      for (const file of hlsFiles) {
        const localPath = path.join(hlsDir, file);
        const blobPath = `${outputPath}/hls/${file}`;
        const uploadedUrl = await azureBlobService.uploadToBlob(localPath, blobPath);

        // Save the master playlist URL
        if (file === 'master.m3u8') {
          hlsMasterUrl = uploadedUrl;
        }
      }

      uploadedFiles.hls = hlsMasterUrl;
    }

    // Upload MP4 variants
    for (const [resolution, localPath] of Object.entries(files.mp4)) {
      const blobPath = `${outputPath}/${resolution}.mp4`;
      const uploadedUrl = await azureBlobService.uploadToBlob(localPath, blobPath);
      uploadedFiles.mp4[resolution] = uploadedUrl;
    }

    // Upload thumbnail
    if (files.thumbnail) {
      const blobPath = `${outputPath}/thumbnail.jpg`;
      const uploadedUrl = await azureBlobService.uploadToBlob(files.thumbnail, blobPath);
      uploadedFiles.thumbnail = uploadedUrl;
    }

    return uploadedFiles;
  }

  /**
   * Get resolution dimensions
   * @param {string} resolution - Resolution string (e.g., '720p')
   * @returns {string} FFmpeg size string
   */
  getResolution(resolution) {
    const resolutions = {
      '1080p': '1920x1080',
      '720p': '1280x720',
      '480p': '854x480',
      '360p': '640x360'
    };
    return resolutions[resolution] || '1280x720';
  }

  /**
   * Clean up temporary files
   * @param {string} inputPath - Input file path
   * @param {string} outputDir - Output directory
   */
  async cleanup(inputPath, outputDir) {
    try {
      await fs.unlink(inputPath);
      await fs.rm(outputDir, { recursive: true, force: true });
      logger.info(`🧹 Cleaned up temp files for transcoding job`);
    } catch (error) {
      logger.warn(`⚠️ Failed to clean up temp files:`, error);
    }
  }

  /**
   * Handle processing errors
   * @param {Error} error - Error object
   */
  async processError(error) {
    logger.error('❌ Transcoding Worker error:', error);
  }
}

// Export singleton instance
module.exports = new TranscodingWorker();
