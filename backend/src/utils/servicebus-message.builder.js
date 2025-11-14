/**
 * Azure Service Bus Message Builder Utility
 *
 * Provides helper functions for building properly formatted Service Bus messages
 * with consistent structure, metadata, and correlation IDs.
 */

/**
 * Build a standard Service Bus message with common properties
 * @param {object} options - Message options
 * @param {object} options.body - Message body
 * @param {string} options.messageId - Unique message ID
 * @param {string} options.correlationId - Correlation ID for tracking
 * @param {string} options.contentType - Content type (default: 'application/json')
 * @param {string} options.subject - Message subject
 * @param {object} options.applicationProperties - Custom application properties
 * @param {number} options.timeToLive - Message TTL in milliseconds
 * @param {Date} options.scheduledEnqueueTime - Schedule message for future delivery
 * @returns {object} Formatted Service Bus message
 */
const buildMessage = (options) => {
  const {
    body,
    messageId,
    correlationId,
    contentType = 'application/json',
    subject,
    applicationProperties = {},
    timeToLive,
    scheduledEnqueueTime
  } = options;

  const message = {
    body,
    contentType,
    messageId,
    correlationId
  };

  if (subject) {
    message.subject = subject;
  }

  if (Object.keys(applicationProperties).length > 0) {
    message.applicationProperties = applicationProperties;
  }

  if (timeToLive) {
    message.timeToLive = timeToLive;
  }

  if (scheduledEnqueueTime) {
    message.scheduledEnqueueTime = scheduledEnqueueTime;
  }

  return message;
};

/**
 * Build a video upload message
 * @param {object} videoData - Video data
 * @returns {object} Service Bus message
 */
const buildVideoUploadMessage = (videoData) => {
  return buildMessage({
    body: {
      videoId: videoData.videoId,
      tenantId: videoData.tenantId,
      blobUrl: videoData.blobUrl,
      fileName: videoData.fileName,
      fileSize: videoData.fileSize,
      contentType: videoData.contentType,
      metadata: videoData.metadata || {},
      uploadedBy: videoData.uploadedBy,
      timestamp: new Date().toISOString()
    },
    messageId: `video-upload-${videoData.videoId}-${Date.now()}`,
    correlationId: videoData.videoId,
    subject: 'video.uploaded',
    applicationProperties: {
      tenantId: videoData.tenantId,
      operation: 'video-upload',
      priority: videoData.priority || 'normal'
    }
  });
};

/**
 * Build a transcoding job message
 * @param {object} transcodingData - Transcoding data
 * @returns {object} Service Bus message
 */
const buildTranscodingMessage = (transcodingData) => {
  return buildMessage({
    body: {
      videoId: transcodingData.videoId,
      tenantId: transcodingData.tenantId,
      inputUrl: transcodingData.inputUrl,
      outputPath: transcodingData.outputPath,
      settings: transcodingData.settings || {
        formats: ['hls', 'mp4'],
        resolutions: ['1080p', '720p', '480p', '360p'],
        codec: 'h264',
        audioCodec: 'aac',
        bitrate: 'auto'
      },
      timestamp: new Date().toISOString()
    },
    messageId: `transcoding-${transcodingData.videoId}-${Date.now()}`,
    correlationId: transcodingData.videoId,
    subject: 'video.transcode',
    applicationProperties: {
      tenantId: transcodingData.tenantId,
      operation: 'video-transcoding',
      estimatedDuration: transcodingData.estimatedDuration
    }
  });
};

/**
 * Build an AI analysis request message
 * @param {object} analysisData - AI analysis data
 * @returns {object} Service Bus message
 */
const buildAIAnalysisMessage = (analysisData) => {
  return buildMessage({
    body: {
      videoId: analysisData.videoId,
      tenantId: analysisData.tenantId,
      videoUrl: analysisData.videoUrl,
      analysisTypes: analysisData.analysisTypes || [
        'content-safety',
        'scene-detection',
        'object-recognition'
      ],
      options: analysisData.options || {
        sensitivity: 'medium',
        language: 'en',
        includeTimestamps: true
      },
      timestamp: new Date().toISOString()
    },
    messageId: `ai-analysis-${analysisData.videoId}-${Date.now()}`,
    correlationId: analysisData.videoId,
    subject: 'video.analyze',
    applicationProperties: {
      tenantId: analysisData.tenantId,
      operation: 'ai-analysis',
      priority: analysisData.priority || 'normal'
    }
  });
};

/**
 * Build a .NET processing request message
 * @param {object} processingData - Processing data
 * @returns {object} Service Bus message
 */
const buildDotNetProcessingMessage = (processingData) => {
  return buildMessage({
    body: {
      type: processingData.type,
      videoId: processingData.videoId,
      tenantId: processingData.tenantId,
      videoUrl: processingData.videoUrl,
      parameters: processingData.parameters || {},
      priority: processingData.priority || 'normal',
      timestamp: new Date().toISOString()
    },
    messageId: `dotnet-${processingData.type}-${processingData.videoId}-${Date.now()}`,
    correlationId: processingData.videoId,
    subject: `dotnet.${processingData.type}`,
    applicationProperties: {
      tenantId: processingData.tenantId,
      operation: processingData.type,
      source: 'nodejs-backend',
      priority: processingData.priority || 'normal'
    }
  });
};

/**
 * Build a notification message
 * @param {object} notificationData - Notification data
 * @returns {object} Service Bus message
 */
const buildNotificationMessage = (notificationData) => {
  return buildMessage({
    body: {
      userId: notificationData.userId,
      tenantId: notificationData.tenantId,
      type: notificationData.type,
      title: notificationData.title,
      message: notificationData.message,
      data: notificationData.data || {},
      priority: notificationData.priority || 'normal',
      channels: notificationData.channels || ['web', 'email'],
      timestamp: new Date().toISOString()
    },
    messageId: `notification-${notificationData.userId}-${Date.now()}`,
    correlationId: notificationData.userId,
    subject: `notification.${notificationData.type}`,
    applicationProperties: {
      tenantId: notificationData.tenantId,
      userId: notificationData.userId,
      notificationType: notificationData.type,
      priority: notificationData.priority || 'normal'
    }
  });
};

/**
 * Build a video event message (for topic publishing)
 * @param {object} eventData - Event data
 * @returns {object} Service Bus message
 */
const buildVideoEventMessage = (eventData) => {
  return buildMessage({
    body: {
      eventType: eventData.eventType,
      videoId: eventData.videoId,
      tenantId: eventData.tenantId,
      payload: eventData.payload || {},
      source: eventData.source || 'video-service',
      timestamp: new Date().toISOString()
    },
    messageId: `video-event-${eventData.eventType}-${eventData.videoId}-${Date.now()}`,
    correlationId: eventData.videoId,
    subject: `video.${eventData.eventType}`,
    applicationProperties: {
      tenantId: eventData.tenantId,
      eventType: eventData.eventType,
      source: eventData.source || 'video-service'
    }
  });
};

/**
 * Build a processing event message (for topic publishing)
 * @param {object} eventData - Event data
 * @returns {object} Service Bus message
 */
const buildProcessingEventMessage = (eventData) => {
  return buildMessage({
    body: {
      eventType: eventData.eventType,
      videoId: eventData.videoId,
      tenantId: eventData.tenantId,
      stage: eventData.stage,
      progress: eventData.progress,
      status: eventData.status,
      metadata: eventData.metadata || {},
      timestamp: new Date().toISOString()
    },
    messageId: `processing-event-${eventData.eventType}-${eventData.videoId}-${Date.now()}`,
    correlationId: eventData.videoId,
    subject: `processing.${eventData.eventType}`,
    applicationProperties: {
      tenantId: eventData.tenantId,
      eventType: eventData.eventType,
      stage: eventData.stage,
      status: eventData.status
    }
  });
};

/**
 * Build an AI analysis result message (for topic publishing)
 * @param {object} resultData - Result data
 * @returns {object} Service Bus message
 */
const buildAIAnalysisResultMessage = (resultData) => {
  return buildMessage({
    body: {
      videoId: resultData.videoId,
      tenantId: resultData.tenantId,
      analysisType: resultData.analysisType,
      results: resultData.results,
      status: resultData.status,
      confidence: resultData.confidence,
      metadata: resultData.metadata || {},
      timestamp: new Date().toISOString()
    },
    messageId: `ai-result-${resultData.analysisType}-${resultData.videoId}-${Date.now()}`,
    correlationId: resultData.videoId,
    subject: `ai.${resultData.analysisType}`,
    applicationProperties: {
      tenantId: resultData.tenantId,
      analysisType: resultData.analysisType,
      status: resultData.status,
      confidence: resultData.confidence || 0
    }
  });
};

/**
 * Build a response message from .NET back to Node.js
 * @param {object} responseData - Response data
 * @returns {object} Service Bus message
 */
const buildDotNetResponseMessage = (responseData) => {
  return buildMessage({
    body: {
      videoId: responseData.videoId,
      tenantId: responseData.tenantId,
      processingType: responseData.processingType,
      status: responseData.status,
      results: responseData.results || {},
      error: responseData.error,
      metadata: responseData.metadata || {},
      processedAt: new Date().toISOString()
    },
    messageId: `dotnet-response-${responseData.videoId}-${Date.now()}`,
    correlationId: responseData.videoId,
    subject: `dotnet.response.${responseData.status}`,
    applicationProperties: {
      tenantId: responseData.tenantId,
      processingType: responseData.processingType,
      status: responseData.status,
      source: 'dotnet-api'
    }
  });
};

/**
 * Build a batch of messages
 * @param {array} messages - Array of message builders
 * @returns {array} Array of Service Bus messages
 */
const buildBatchMessages = (messages) => {
  return messages.map(msg => msg);
};

/**
 * Add retry metadata to a message
 * @param {object} message - Original message
 * @param {number} retryCount - Current retry count
 * @param {string} originalMessageId - Original message ID
 * @returns {object} Message with retry metadata
 */
const addRetryMetadata = (message, retryCount, originalMessageId) => {
  return {
    ...message,
    applicationProperties: {
      ...message.applicationProperties,
      retryCount,
      originalMessageId,
      isRetry: true
    }
  };
};

/**
 * Schedule a message for future delivery
 * @param {object} message - Original message
 * @param {Date|number} deliveryTime - Delivery time (Date object or milliseconds from now)
 * @returns {object} Scheduled message
 */
const scheduleMessage = (message, deliveryTime) => {
  const scheduledTime = deliveryTime instanceof Date
    ? deliveryTime
    : new Date(Date.now() + deliveryTime);

  return {
    ...message,
    scheduledEnqueueTime: scheduledTime
  };
};

module.exports = {
  buildMessage,
  buildVideoUploadMessage,
  buildTranscodingMessage,
  buildAIAnalysisMessage,
  buildDotNetProcessingMessage,
  buildNotificationMessage,
  buildVideoEventMessage,
  buildProcessingEventMessage,
  buildAIAnalysisResultMessage,
  buildDotNetResponseMessage,
  buildBatchMessages,
  addRetryMetadata,
  scheduleMessage
};
