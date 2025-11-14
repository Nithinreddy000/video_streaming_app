const { getQueueReceiver, QUEUE_NAMES } = require('../../config/servicebus');
const serviceBusService = require('../../services/servicebus.service');
const logger = require('../../utils/logger');
const { emitProcessingProgress } = require('../../config/socket');

// Lazy load Video model to avoid Mongoose model compilation issues
let Video = null;
const getVideoModel = () => {
  if (!Video) {
    Video = require('../../models/video.model');
  }
  return Video;
};

/**
 * Video Upload Queue Worker
 *
 * Processes video upload messages from Azure Service Bus.
 * Handles initial video processing and triggers transcoding.
 */

class VideoUploadWorker {
  constructor() {
    this.receiver = null;
    this.isRunning = false;
  }

  /**
   * Start the worker
   */
  async start() {
    try {
      this.receiver = getQueueReceiver(QUEUE_NAMES.VIDEO_UPLOAD, {
        receiveMode: 'peekLock',
        maxAutoLockRenewalDuration: 300000 // 5 minutes
      });

      this.isRunning = true;
      logger.info('✅ Video Upload Worker started');

      // Set up message handler
      this.receiver.subscribe({
        processMessage: this.processMessage.bind(this),
        processError: this.processError.bind(this)
      });
    } catch (error) {
      logger.error('❌ Failed to start Video Upload Worker:', error);
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
        logger.info('✅ Video Upload Worker stopped');
      }
    } catch (error) {
      logger.error('❌ Error stopping Video Upload Worker:', error);
    }
  }

  /**
   * Process a single message
   * @param {ServiceBusReceivedMessage} message - Service Bus message
   */
  async processMessage(message) {
    const startTime = Date.now();
    const messageBody = message.body;

    logger.info(`📥 Processing video upload: ${messageBody.videoId}`);

    try {
      // Extract message data
      const { videoId, tenantId, blobUrl, fileName, fileSize, metadata, uploadedBy } = messageBody;

      // Update video status to 'queued'
      const video = await getVideoModel().findByIdAndUpdate(
        videoId,
        {
          status: 'queued',
          blobUrl,
          fileName,
          fileSize,
          metadata,
          queuedAt: new Date()
        },
        { new: true }
      );

      if (!video) {
        throw new Error(`Video not found: ${videoId}`);
      }

      // Emit progress via Socket.IO
      emitProcessingProgress(videoId, 10, 'queued', uploadedBy, tenantId);

      // Publish to transcoding queue
      await serviceBusService.publishTranscodingJob({
        videoId,
        tenantId,
        inputUrl: blobUrl,
        outputPath: `processed/${tenantId}/${videoId}`,
        settings: {
          formats: ['hls', 'mp4'],
          resolutions: ['1080p', '720p', '480p', '360p'],
          codec: 'h264',
          audioCodec: 'aac'
        }
      });

      // Publish video event
      await serviceBusService.publishVideoEvent({
        eventType: 'uploaded',
        videoId,
        tenantId,
        payload: {
          fileName,
          fileSize,
          uploadedBy,
          blobUrl
        }
      });

      // Complete the message
      await this.receiver.completeMessage(message);

      const processingTime = Date.now() - startTime;
      logger.info(`✅ Video upload processed: ${videoId} (${processingTime}ms)`);
    } catch (error) {
      logger.error(`❌ Error processing video upload: ${messageBody.videoId}`, error);

      // Update video status to failed
      try {
        await getVideoModel().findByIdAndUpdate(messageBody.videoId, {
          status: 'failed',
          error: error.message,
          failedAt: new Date()
        });

        // Emit error via Socket.IO
        emitProcessingProgress(messageBody.videoId, 0, 'failed', messageBody.uploadedBy, messageBody.tenantId);
      } catch (updateError) {
        logger.error(`❌ Failed to update video status: ${messageBody.videoId}`, updateError);
      }

      // Dead-letter the message if retry count exceeded
      if (message.deliveryCount > 3) {
        logger.warn(`⚠️ Moving message to dead-letter queue: ${messageBody.videoId}`);
        await this.receiver.deadLetterMessage(message, {
          deadLetterReason: 'MaxDeliveryCountExceeded',
          deadLetterErrorDescription: error.message
        });
      } else {
        // Abandon the message for retry
        await this.receiver.abandonMessage(message);
      }
    }
  }

  /**
   * Handle processing errors
   * @param {Error} error - Error object
   */
  async processError(error) {
    logger.error('❌ Video Upload Worker error:', error);
  }
}

// Export singleton instance
module.exports = new VideoUploadWorker();
