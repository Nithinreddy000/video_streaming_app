const {
  getQueueSender,
  getTopicSender,
  isServiceBusAvailable,
  QUEUE_NAMES,
  TOPIC_NAMES
} = require('../config/servicebus');
const logger = require('../utils/logger');

/**
 * Azure Service Bus Service Layer
 *
 * High-level service for publishing messages to Service Bus queues and topics.
 * Handles message formatting, error handling, and logging.
 */

class ServiceBusService {
  /**
   * Publish video upload event to queue
   * @param {object} videoData - Video upload data
   * @param {string} videoData.videoId - Video ID
   * @param {string} videoData.tenantId - Tenant ID
   * @param {string} videoData.blobUrl - Azure Blob URL
   * @param {string} videoData.fileName - Original file name
   * @param {number} videoData.fileSize - File size in bytes
   * @param {object} videoData.metadata - Additional metadata
   */
  async publishVideoUpload(videoData) {
    if (!isServiceBusAvailable()) {
      logger.warn('Service Bus not available. Skipping video upload publish.');
      return;
    }

    const sender = getQueueSender(QUEUE_NAMES.VIDEO_UPLOAD);

    try {
      const message = {
        body: {
          videoId: videoData.videoId,
          tenantId: videoData.tenantId,
          blobUrl: videoData.blobUrl,
          fileName: videoData.fileName,
          fileSize: videoData.fileSize,
          metadata: videoData.metadata || {},
          timestamp: new Date().toISOString()
        },
        contentType: 'application/json',
        messageId: `video-upload-${videoData.videoId}-${Date.now()}`,
        correlationId: videoData.videoId,
        applicationProperties: {
          tenantId: videoData.tenantId,
          operation: 'video-upload'
        }
      };

      await sender.sendMessages(message);
      logger.info(`📤 Published video upload to Service Bus: ${videoData.videoId}`);
    } catch (error) {
      logger.error(`❌ Failed to publish video upload: ${videoData.videoId}`, error);
      throw error;
    } finally {
      await sender.close();
    }
  }

  /**
   * Publish transcoding job to queue
   * @param {object} transcodingData - Transcoding job data
   * @param {string} transcodingData.videoId - Video ID
   * @param {string} transcodingData.tenantId - Tenant ID
   * @param {string} transcodingData.inputUrl - Input video URL
   * @param {string} transcodingData.outputPath - Output directory path
   * @param {object} transcodingData.settings - Transcoding settings
   */
  async publishTranscodingJob(transcodingData) {
    if (!isServiceBusAvailable()) {
      logger.warn('Service Bus not available. Skipping transcoding job publish.');
      return;
    }

    const sender = getQueueSender(QUEUE_NAMES.VIDEO_TRANSCODING);

    try {
      const message = {
        body: {
          videoId: transcodingData.videoId,
          tenantId: transcodingData.tenantId,
          inputUrl: transcodingData.inputUrl,
          outputPath: transcodingData.outputPath,
          settings: transcodingData.settings || {
            formats: ['hls', 'mp4'],
            resolutions: ['1080p', '720p', '480p', '360p'],
            codec: 'h264',
            audioCodec: 'aac'
          },
          timestamp: new Date().toISOString()
        },
        contentType: 'application/json',
        messageId: `transcoding-${transcodingData.videoId}-${Date.now()}`,
        correlationId: transcodingData.videoId,
        applicationProperties: {
          tenantId: transcodingData.tenantId,
          operation: 'video-transcoding'
        }
      };

      await sender.sendMessages(message);
      logger.info(`📤 Published transcoding job to Service Bus: ${transcodingData.videoId}`);
    } catch (error) {
      logger.error(`❌ Failed to publish transcoding job: ${transcodingData.videoId}`, error);
      throw error;
    } finally {
      await sender.close();
    }
  }

  /**
   * Publish AI analysis request to queue
   * @param {object} analysisData - AI analysis request data
   * @param {string} analysisData.videoId - Video ID
   * @param {string} analysisData.tenantId - Tenant ID
   * @param {string} analysisData.videoUrl - Video URL for analysis
   * @param {string[]} analysisData.analysisTypes - Types of analysis to perform
   */
  async publishAIAnalysisRequest(analysisData) {
    if (!isServiceBusAvailable()) {
      logger.warn('Service Bus not available. Skipping AI analysis publish.');
      return;
    }

    const sender = getQueueSender(QUEUE_NAMES.AI_ANALYSIS);

    try {
      const message = {
        body: {
          videoId: analysisData.videoId,
          tenantId: analysisData.tenantId,
          videoUrl: analysisData.videoUrl,
          analysisTypes: analysisData.analysisTypes || [
            'content-safety',
            'scene-detection',
            'object-recognition'
          ],
          timestamp: new Date().toISOString()
        },
        contentType: 'application/json',
        messageId: `ai-analysis-${analysisData.videoId}-${Date.now()}`,
        correlationId: analysisData.videoId,
        applicationProperties: {
          tenantId: analysisData.tenantId,
          operation: 'ai-analysis'
        }
      };

      await sender.sendMessages(message);
      logger.info(`📤 Published AI analysis request to Service Bus: ${analysisData.videoId}`);
    } catch (error) {
      logger.error(`❌ Failed to publish AI analysis: ${analysisData.videoId}`, error);
      throw error;
    } finally {
      await sender.close();
    }
  }

  /**
   * Publish advanced processing request to .NET microservice
   * @param {object} processingData - Processing request data
   * @param {string} processingData.type - Processing type ('advanced-analysis', 'ml-inference', etc.)
   * @param {string} processingData.videoId - Video ID
   * @param {string} processingData.tenantId - Tenant ID
   * @param {string} processingData.videoUrl - Video URL
   * @param {object} processingData.parameters - Processing parameters
   */
  async publishToDotNet(processingData) {
    if (!isServiceBusAvailable()) {
      logger.warn('Service Bus not available. Skipping .NET processing publish.');
      return;
    }

    const sender = getQueueSender(QUEUE_NAMES.DOTNET_PROCESSING);

    try {
      const message = {
        body: {
          type: processingData.type,
          videoId: processingData.videoId,
          tenantId: processingData.tenantId,
          videoUrl: processingData.videoUrl,
          parameters: processingData.parameters || {},
          timestamp: new Date().toISOString()
        },
        contentType: 'application/json',
        messageId: `dotnet-${processingData.type}-${processingData.videoId}-${Date.now()}`,
        correlationId: processingData.videoId,
        applicationProperties: {
          tenantId: processingData.tenantId,
          operation: processingData.type,
          source: 'nodejs-backend'
        }
      };

      await sender.sendMessages(message);
      logger.info(`📤 Published to .NET microservice: ${processingData.type} for ${processingData.videoId}`);
    } catch (error) {
      logger.error(`❌ Failed to publish to .NET: ${processingData.videoId}`, error);
      throw error;
    } finally {
      await sender.close();
    }
  }

  /**
   * Publish notification to queue
   * @param {object} notificationData - Notification data
   * @param {string} notificationData.userId - User ID
   * @param {string} notificationData.tenantId - Tenant ID
   * @param {string} notificationData.type - Notification type
   * @param {string} notificationData.title - Notification title
   * @param {string} notificationData.message - Notification message
   * @param {object} notificationData.data - Additional data
   */
  async publishNotification(notificationData) {
    if (!isServiceBusAvailable()) {
      logger.warn('Service Bus not available. Skipping notification publish.');
      return;
    }

    const sender = getQueueSender(QUEUE_NAMES.NOTIFICATION);

    try {
      const message = {
        body: {
          userId: notificationData.userId,
          tenantId: notificationData.tenantId,
          type: notificationData.type,
          title: notificationData.title,
          message: notificationData.message,
          data: notificationData.data || {},
          timestamp: new Date().toISOString()
        },
        contentType: 'application/json',
        messageId: `notification-${notificationData.userId}-${Date.now()}`,
        applicationProperties: {
          tenantId: notificationData.tenantId,
          userId: notificationData.userId,
          notificationType: notificationData.type
        }
      };

      await sender.sendMessages(message);
      logger.info(`📤 Published notification to Service Bus: ${notificationData.type} for user ${notificationData.userId}`);
    } catch (error) {
      logger.error(`❌ Failed to publish notification for user ${notificationData.userId}`, error);
      throw error;
    } finally {
      await sender.close();
    }
  }

  /**
   * Publish video event to topic (fan-out pattern)
   * @param {object} eventData - Video event data
   * @param {string} eventData.eventType - Event type ('uploaded', 'processed', 'deleted', etc.)
   * @param {string} eventData.videoId - Video ID
   * @param {string} eventData.tenantId - Tenant ID
   * @param {object} eventData.payload - Event payload
   */
  async publishVideoEvent(eventData) {
    if (!isServiceBusAvailable()) {
      logger.warn('Service Bus not available. Skipping video event publish.');
      return;
    }

    const sender = getTopicSender(TOPIC_NAMES.VIDEO_EVENTS);

    try {
      const message = {
        body: {
          eventType: eventData.eventType,
          videoId: eventData.videoId,
          tenantId: eventData.tenantId,
          payload: eventData.payload || {},
          timestamp: new Date().toISOString()
        },
        contentType: 'application/json',
        messageId: `video-event-${eventData.eventType}-${eventData.videoId}-${Date.now()}`,
        correlationId: eventData.videoId,
        subject: eventData.eventType,
        applicationProperties: {
          tenantId: eventData.tenantId,
          eventType: eventData.eventType
        }
      };

      await sender.sendMessages(message);
      logger.info(`📤 Published video event to topic: ${eventData.eventType} for ${eventData.videoId}`);
    } catch (error) {
      logger.error(`❌ Failed to publish video event: ${eventData.eventType} for ${eventData.videoId}`, error);
      throw error;
    } finally {
      await sender.close();
    }
  }

  /**
   * Publish processing event to topic
   * @param {object} eventData - Processing event data
   * @param {string} eventData.eventType - Event type ('started', 'progress', 'completed', 'failed')
   * @param {string} eventData.videoId - Video ID
   * @param {string} eventData.tenantId - Tenant ID
   * @param {string} eventData.stage - Processing stage
   * @param {number} eventData.progress - Progress percentage (0-100)
   * @param {object} eventData.metadata - Additional metadata
   */
  async publishProcessingEvent(eventData) {
    if (!isServiceBusAvailable()) {
      logger.warn('Service Bus not available. Skipping processing event publish.');
      return;
    }

    const sender = getTopicSender(TOPIC_NAMES.PROCESSING_EVENTS);

    try {
      const message = {
        body: {
          eventType: eventData.eventType,
          videoId: eventData.videoId,
          tenantId: eventData.tenantId,
          stage: eventData.stage,
          progress: eventData.progress,
          metadata: eventData.metadata || {},
          timestamp: new Date().toISOString()
        },
        contentType: 'application/json',
        messageId: `processing-event-${eventData.eventType}-${eventData.videoId}-${Date.now()}`,
        correlationId: eventData.videoId,
        subject: eventData.eventType,
        applicationProperties: {
          tenantId: eventData.tenantId,
          eventType: eventData.eventType,
          stage: eventData.stage
        }
      };

      await sender.sendMessages(message);
      logger.info(`📤 Published processing event: ${eventData.eventType} for ${eventData.videoId} (${eventData.progress}%)`);
    } catch (error) {
      logger.error(`❌ Failed to publish processing event: ${eventData.eventType} for ${eventData.videoId}`, error);
      throw error;
    } finally {
      await sender.close();
    }
  }

  /**
   * Publish AI analysis result to topic
   * @param {object} resultData - AI analysis result data
   * @param {string} resultData.videoId - Video ID
   * @param {string} resultData.tenantId - Tenant ID
   * @param {string} resultData.analysisType - Analysis type
   * @param {object} resultData.results - Analysis results
   * @param {string} resultData.status - Analysis status
   */
  async publishAIAnalysisResult(resultData) {
    if (!isServiceBusAvailable()) {
      logger.warn('Service Bus not available. Skipping AI analysis result publish.');
      return;
    }

    const sender = getTopicSender(TOPIC_NAMES.AI_ANALYSIS_RESULTS);

    try {
      const message = {
        body: {
          videoId: resultData.videoId,
          tenantId: resultData.tenantId,
          analysisType: resultData.analysisType,
          results: resultData.results,
          status: resultData.status,
          timestamp: new Date().toISOString()
        },
        contentType: 'application/json',
        messageId: `ai-result-${resultData.analysisType}-${resultData.videoId}-${Date.now()}`,
        correlationId: resultData.videoId,
        subject: resultData.analysisType,
        applicationProperties: {
          tenantId: resultData.tenantId,
          analysisType: resultData.analysisType,
          status: resultData.status
        }
      };

      await sender.sendMessages(message);
      logger.info(`📤 Published AI analysis result: ${resultData.analysisType} for ${resultData.videoId}`);
    } catch (error) {
      logger.error(`❌ Failed to publish AI analysis result: ${resultData.analysisType} for ${resultData.videoId}`, error);
      throw error;
    } finally {
      await sender.close();
    }
  }
}

// Export singleton instance
module.exports = new ServiceBusService();
