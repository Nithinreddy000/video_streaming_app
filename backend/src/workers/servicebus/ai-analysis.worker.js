const { getQueueReceiver, QUEUE_NAMES } = require('../../config/servicebus');
const serviceBusService = require('../../services/servicebus.service');
const logger = require('../../utils/logger');
const { emitAIAnalysisComplete, emitProcessingComplete } = require('../../config/socket');
const azureAIService = require('../../services/azure-ai.service');

// Lazy load Video model to avoid Mongoose model compilation issues
let Video = null;
const getVideoModel = () => {
  if (!Video) {
    Video = require('../../models/video.model');
  }
  return Video;
};

/**
 * AI Analysis Queue Worker
 *
 * Processes AI analysis requests from Azure Service Bus.
 * Handles content safety analysis using Azure AI Content Safety.
 */

class AIAnalysisWorker {
  constructor() {
    this.receiver = null;
    this.isRunning = false;
  }

  /**
   * Start the worker
   */
  async start() {
    try {
      this.receiver = getQueueReceiver(QUEUE_NAMES.AI_ANALYSIS, {
        receiveMode: 'peekLock',
        maxAutoLockRenewalDuration: 300000 // 5 minutes
      });

      this.isRunning = true;
      logger.info('✅ AI Analysis Worker started');

      // Set up message handler
      this.receiver.subscribe({
        processMessage: this.processMessage.bind(this),
        processError: this.processError.bind(this)
      });
    } catch (error) {
      logger.error('❌ Failed to start AI Analysis Worker:', error);
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
        logger.info('✅ AI Analysis Worker stopped');
      }
    } catch (error) {
      logger.error('❌ Error stopping AI Analysis Worker:', error);
    }
  }

  /**
   * Process a single message
   * @param {ServiceBusReceivedMessage} message - Service Bus message
   */
  async processMessage(message) {
    const startTime = Date.now();
    const messageBody = message.body;
    const { videoId, tenantId, videoUrl, analysisTypes } = messageBody;

    logger.info(`📥 Processing AI analysis: ${videoId}`);

    try {
      // Perform AI content safety analysis
      const analysisResult = await azureAIService.analyzeVideoContent(videoUrl);

      // Determine content status based on severity
      const maxSeverity = Math.max(
        ...analysisResult.categories.map(cat => cat.severity)
      );

      let contentStatus = 'safe';
      if (maxSeverity >= 4) {
        contentStatus = 'blocked';
      } else if (maxSeverity >= 2) {
        contentStatus = 'flagged';
      }

      // Update video with AI analysis results
      const video = await getVideoModel().findByIdAndUpdate(
        videoId,
        {
          aiAnalysis: {
            status: contentStatus,
            categories: analysisResult.categories,
            overallScore: analysisResult.overallScore,
            analyzedAt: new Date()
          }
        },
        { new: true }
      );

      if (!video) {
        throw new Error(`Video not found: ${videoId}`);
      }

      // Log the aiAnalysis to verify it was updated
      if (!video.aiAnalysis) {
        logger.warn(`⚠️ Video aiAnalysis is undefined after update: ${videoId}`);
      } else {
        logger.debug(`AI analysis updated for video ${videoId}: ${video.aiAnalysis.status}`);
      }

      // Emit AI analysis complete via Socket.IO
      emitAIAnalysisComplete(videoId, video.aiAnalysis, tenantId);

      // Publish AI analysis result to topic
      await serviceBusService.publishAIAnalysisResult({
        videoId,
        tenantId,
        analysisType: 'content-safety',
        results: analysisResult,
        status: contentStatus
      });

      // If content is flagged or blocked, publish notification
      if (contentStatus !== 'safe') {
        await serviceBusService.publishNotification({
          userId: video.uploader,
          tenantId,
          type: contentStatus === 'blocked' ? 'content_blocked' : 'content_flagged',
          title: 'Content Moderation Alert',
          message: `Your video "${video.title}" has been ${contentStatus} due to potential policy violations.`,
          data: {
            videoId,
            analysisResult
          }
        });
      }

      // Check if advanced .NET processing is needed
      if (analysisTypes && analysisTypes.includes('advanced-analysis')) {
        await serviceBusService.publishToDotNet({
          type: 'advanced-analysis',
          videoId,
          tenantId,
          videoUrl,
          parameters: {
            sceneDetection: true,
            objectRecognition: true,
            motionAnalysis: true
          }
        });
      }

      // Complete the message
      await this.receiver.completeMessage(message);

      const processingTime = Date.now() - startTime;
      logger.info(`✅ AI analysis completed: ${videoId} (${processingTime}ms) - Status: ${contentStatus}`);

      // Emit processing complete event to notify frontend
      const completedVideo = await getVideoModel().findById(videoId);
      if (completedVideo) {
        emitProcessingComplete(videoId, completedVideo);
      }
    } catch (error) {
      logger.error(`❌ Error processing AI analysis: ${videoId}`, error);
      // Update video with error
      try {
        await getVideoModel().findByIdAndUpdate(videoId, {
          'aiAnalysis.status': 'error',
          'aiAnalysis.error': error.message,
          'aiAnalysis.analyzedAt': new Date()
        });
      } catch (updateError) {
        logger.error(`❌ Failed to update video AI status: ${videoId}`, updateError);
      }

      // Dead-letter if retry exceeded
      if (message.deliveryCount > 3) {
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
   * Handle processing errors
   * @param {Error} error - Error object
   */
  async processError(error) {
    logger.error('❌ AI Analysis Worker error:', error);
  }
}

// Export singleton instance
module.exports = new AIAnalysisWorker();
