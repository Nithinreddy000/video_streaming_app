const { getQueueReceiver, QUEUE_NAMES } = require('../../config/servicebus');
const logger = require('../../utils/logger');
const { emitProcessingComplete } = require('../../config/socket');

// Lazy load Video model to avoid Mongoose model compilation issues
let Video = null;
const getVideoModel = () => {
  if (!Video) {
    Video = require('../../models/video.model');
  }
  return Video;
};

/**
 * Response Handler Worker
 *
 * Processes response messages from .NET Minimal API microservice.
 * Handles advanced processing results and updates video records.
 */

class ResponseHandlerWorker {
  constructor() {
    this.receiver = null;
    this.isRunning = false;
  }

  /**
   * Start the worker
   */
  async start() {
    try {
      this.receiver = getQueueReceiver(QUEUE_NAMES.DOTNET_RESPONSE, {
        receiveMode: 'peekLock',
        maxAutoLockRenewalDuration: 300000 // 5 minutes
      });

      this.isRunning = true;
      logger.info('✅ Response Handler Worker started');

      // Set up message handler
      this.receiver.subscribe({
        processMessage: this.processMessage.bind(this),
        processError: this.processError.bind(this)
      });
    } catch (error) {
      logger.error('❌ Failed to start Response Handler Worker:', error);
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
        logger.info('✅ Response Handler Worker stopped');
      }
    } catch (error) {
      logger.error('❌ Error stopping Response Handler Worker:', error);
    }
  }

  /**
   * Process a single message
   * @param {ServiceBusReceivedMessage} message - Service Bus message
   */
  async processMessage(message) {
    const startTime = Date.now();
    const messageBody = message.body;
    const { videoId, tenantId, processingType, status, results, error, metadata } = messageBody;

    logger.info(`📥 Processing .NET response: ${videoId} (${processingType})`);

    try {
      // Route to appropriate handler based on processing type
      switch (processingType) {
        case 'advanced-analysis':
          await this.handleAdvancedAnalysis(videoId, tenantId, status, results, error);
          break;

        case 'ml-inference':
          await this.handleMLInference(videoId, tenantId, status, results, error);
          break;

        case 'scene-detection':
          await this.handleSceneDetection(videoId, tenantId, status, results, error);
          break;

        case 'object-recognition':
          await this.handleObjectRecognition(videoId, tenantId, status, results, error);
          break;

        default:
          logger.warn(`⚠️ Unknown processing type: ${processingType}`);
          await this.handleGenericResponse(videoId, processingType, status, results, error);
      }

      // Complete the message
      await this.receiver.completeMessage(message);

      const processingTime = Date.now() - startTime;
      logger.info(`✅ .NET response processed: ${videoId} (${processingTime}ms)`);
    } catch (processingError) {
      logger.error(`❌ Error processing .NET response: ${videoId}`, processingError);

      // Dead-letter if retry exceeded
      if (message.deliveryCount > 3) {
        logger.warn(`⚠️ Moving message to dead-letter queue: ${videoId}`);
        await this.receiver.deadLetterMessage(message, {
          deadLetterReason: 'MaxDeliveryCountExceeded',
          deadLetterErrorDescription: processingError.message
        });
      } else {
        await this.receiver.abandonMessage(message);
      }
    }
  }

  /**
   * Handle advanced analysis results
   * @param {string} videoId - Video ID
   * @param {string} tenantId - Tenant ID
   * @param {string} status - Processing status
   * @param {object} results - Analysis results
   * @param {string} error - Error message if failed
   */
  async handleAdvancedAnalysis(videoId, tenantId, status, results, error) {
    if (status === 'completed') {
      // Update video with advanced analysis results
      await getVideoModel().findByIdAndUpdate(videoId, {
        $set: {
          'advancedAnalysis.qualityScore': results.quality_score,
          'advancedAnalysis.sceneDetection': results.scene_detection,
          'advancedAnalysis.motionAnalysis': results.motion_analysis,
          'advancedAnalysis.completedAt': new Date()
        }
      });

      logger.info(`✅ Advanced analysis completed for ${videoId}: Quality ${results.quality_score}`);
    } else if (status === 'failed') {
      logger.error(`❌ Advanced analysis failed for ${videoId}: ${error}`);

      await getVideoModel().findByIdAndUpdate(videoId, {
        $set: {
          'advancedAnalysis.status': 'failed',
          'advancedAnalysis.error': error,
          'advancedAnalysis.failedAt': new Date()
        }
      });
    }
  }

  /**
   * Handle ML inference results
   * @param {string} videoId - Video ID
   * @param {string} tenantId - Tenant ID
   * @param {string} status - Processing status
   * @param {object} results - ML results
   * @param {string} error - Error message if failed
   */
  async handleMLInference(videoId, tenantId, status, results, error) {
    if (status === 'completed') {
      await getVideoModel().findByIdAndUpdate(videoId, {
        $set: {
          'mlInference.predictions': results.predictions,
          'mlInference.confidence': results.confidence,
          'mlInference.model': results.model_name,
          'mlInference.completedAt': new Date()
        }
      });

      logger.info(`✅ ML inference completed for ${videoId}: Model ${results.model_name}`);
    } else if (status === 'failed') {
      logger.error(`❌ ML inference failed for ${videoId}: ${error}`);

      await getVideoModel().findByIdAndUpdate(videoId, {
        $set: {
          'mlInference.status': 'failed',
          'mlInference.error': error,
          'mlInference.failedAt': new Date()
        }
      });
    }
  }

  /**
   * Handle scene detection results
   * @param {string} videoId - Video ID
   * @param {string} tenantId - Tenant ID
   * @param {string} status - Processing status
   * @param {object} results - Scene detection results
   * @param {string} error - Error message if failed
   */
  async handleSceneDetection(videoId, tenantId, status, results, error) {
    if (status === 'completed') {
      await getVideoModel().findByIdAndUpdate(videoId, {
        $set: {
          'sceneDetection.scenes': results.scenes,
          'sceneDetection.sceneCount': results.scene_count,
          'sceneDetection.timestamps': results.timestamps,
          'sceneDetection.completedAt': new Date()
        }
      });

      logger.info(`✅ Scene detection completed for ${videoId}: ${results.scene_count} scenes found`);

      // Emit to Socket.IO
      emitProcessingComplete(videoId, { sceneDetection: results });
    } else if (status === 'failed') {
      logger.error(`❌ Scene detection failed for ${videoId}: ${error}`);
    }
  }

  /**
   * Handle object recognition results
   * @param {string} videoId - Video ID
   * @param {string} tenantId - Tenant ID
   * @param {string} status - Processing status
   * @param {object} results - Object recognition results
   * @param {string} error - Error message if failed
   */
  async handleObjectRecognition(videoId, tenantId, status, results, error) {
    if (status === 'completed') {
      await getVideoModel().findByIdAndUpdate(videoId, {
        $set: {
          'objectRecognition.objects': results.objects,
          'objectRecognition.objectCount': results.object_count,
          'objectRecognition.confidence': results.confidence,
          'objectRecognition.completedAt': new Date()
        }
      });

      logger.info(`✅ Object recognition completed for ${videoId}: ${results.object_count} objects detected`);

      // Emit to Socket.IO
      emitProcessingComplete(videoId, { objectRecognition: results });
    } else if (status === 'failed') {
      logger.error(`❌ Object recognition failed for ${videoId}: ${error}`);
    }
  }

  /**
   * Handle generic response (fallback)
   * @param {string} videoId - Video ID
   * @param {string} processingType - Processing type
   * @param {string} status - Processing status
   * @param {object} results - Results
   * @param {string} error - Error message if failed
   */
  async handleGenericResponse(videoId, processingType, status, results, error) {
    await getVideoModel().findByIdAndUpdate(videoId, {
      $set: {
        [`dotnetProcessing.${processingType}`]: {
          status,
          results,
          error,
          processedAt: new Date()
        }
      }
    });

    logger.info(`✅ Generic .NET response handled for ${videoId}: ${processingType} - ${status}`);
  }

  /**
   * Handle processing errors
   * @param {Error} error - Error object
   */
  async processError(error) {
    logger.error('❌ Response Handler Worker error:', error);
  }
}

// Export singleton instance
module.exports = new ResponseHandlerWorker();
