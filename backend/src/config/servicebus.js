const { ServiceBusClient } = require('@azure/service-bus');
const logger = require('../utils/logger');

/**
 * Azure Service Bus Configuration Module
 *
 * Provides centralized Service Bus client management and helper functions
 * for creating senders and receivers for queues and topics.
 */

let serviceBusClient = null;

/**
 * Initialize Azure Service Bus client with connection verification
 * @returns {Promise<ServiceBusClient|null>} Initialized client or null if connection string missing
 */
const initializeServiceBus = async () => {
  try {
    const connectionString = process.env.AZURE_SERVICE_BUS_CONNECTION_STRING;

    if (!connectionString) {
      logger.warn('Azure Service Bus connection string not configured. Service Bus features will be disabled.');
      return null;
    }

    serviceBusClient = new ServiceBusClient(connectionString);

    // Verify connection by creating and closing a test receiver
    // This establishes the CBS (Claims Based Security) link before workers start
    try {
      const testReceiver = serviceBusClient.createReceiver('video-upload-queue', {
        receiveMode: 'peekLock'
      });

      // Close the test receiver immediately
      await testReceiver.close();
      logger.info('✅ Azure Service Bus connection verified (CBS link established)');
    } catch (verifyError) {
      logger.error('❌ Service Bus connection verification failed:', verifyError);

      // Close the client and return null if verification fails
      await serviceBusClient.close();
      serviceBusClient = null;
      return null;
    }

    logger.info('✅ Azure Service Bus client initialized successfully');
    return serviceBusClient;
  } catch (error) {
    logger.error('❌ Failed to initialize Azure Service Bus:', error);
    serviceBusClient = null;
    return null;
  }
};

/**
 * Get the Service Bus client instance
 * @returns {ServiceBusClient} Service Bus client
 * @throws {Error} If client not initialized
 */
const getServiceBusClient = () => {
  if (!serviceBusClient) {
    throw new Error('Service Bus client not initialized. Call initializeServiceBus() first.');
  }
  return serviceBusClient;
};

/**
 * Check if Service Bus is available
 * @returns {boolean} True if Service Bus client is initialized
 */
const isServiceBusAvailable = () => {
  return serviceBusClient !== null;
};

/**
 * Create a sender for a specific queue
 * @param {string} queueName - Name of the queue
 * @returns {ServiceBusSender} Queue sender instance
 */
const getQueueSender = (queueName) => {
  const client = getServiceBusClient();
  return client.createSender(queueName);
};

/**
 * Create a receiver for a specific queue
 * @param {string} queueName - Name of the queue
 * @param {object} options - Receiver options (receiveMode, subQueueType, etc.)
 * @returns {ServiceBusReceiver} Queue receiver instance
 */
const getQueueReceiver = (queueName, options = {}) => {
  const client = getServiceBusClient();
  return client.createReceiver(queueName, options);
};

/**
 * Create a sender for a specific topic
 * @param {string} topicName - Name of the topic
 * @returns {ServiceBusSender} Topic sender instance
 */
const getTopicSender = (topicName) => {
  const client = getServiceBusClient();
  return client.createSender(topicName);
};

/**
 * Create a receiver for a topic subscription
 * @param {string} topicName - Name of the topic
 * @param {string} subscriptionName - Name of the subscription
 * @param {object} options - Receiver options (receiveMode, subQueueType, etc.)
 * @returns {ServiceBusReceiver} Subscription receiver instance
 */
const getSubscriptionReceiver = (topicName, subscriptionName, options = {}) => {
  const client = getServiceBusClient();
  return client.createReceiver(topicName, subscriptionName, options);
};

/**
 * Close the Service Bus client and all senders/receivers
 * Call this during application shutdown
 */
const closeServiceBus = async () => {
  if (serviceBusClient) {
    try {
      await serviceBusClient.close();
      logger.info('✅ Azure Service Bus client closed successfully');
      serviceBusClient = null;
    } catch (error) {
      logger.error('❌ Error closing Service Bus client:', error);
    }
  }
};

/**
 * Queue names used in the application
 */
const QUEUE_NAMES = {
  VIDEO_UPLOAD: 'video-upload-queue',
  VIDEO_TRANSCODING: 'video-transcoding-queue',
  AI_ANALYSIS: 'ai-analysis-queue',
  THUMBNAIL_GENERATION: 'thumbnail-generation-queue',
  DOTNET_PROCESSING: 'dotnet-processing-queue',
  DOTNET_RESPONSE: 'dotnet-response-queue',
  NOTIFICATION: 'notification-queue'
};

/**
 * Topic names used in the application
 */
const TOPIC_NAMES = {
  VIDEO_EVENTS: 'video-events-topic',
  PROCESSING_EVENTS: 'processing-events-topic',
  AI_ANALYSIS_RESULTS: 'ai-analysis-results-topic'
};

/**
 * Subscription names for topics
 */
const SUBSCRIPTION_NAMES = {
  VIDEO_EVENTS: {
    ANALYTICS: 'analytics-subscription',
    NOTIFICATION: 'notification-subscription',
    AUDIT: 'audit-subscription',
    SEARCH_INDEX: 'search-index-subscription'
  },
  PROCESSING_EVENTS: {
    MONITORING: 'monitoring-subscription',
    BILLING: 'billing-subscription'
  },
  AI_ANALYSIS_RESULTS: {
    MODERATION: 'moderation-subscription',
    COMPLIANCE: 'compliance-subscription',
    ML_TRAINING: 'ml-training-subscription'
  }
};

module.exports = {
  initializeServiceBus,
  getServiceBusClient,
  isServiceBusAvailable,
  getQueueSender,
  getQueueReceiver,
  getTopicSender,
  getSubscriptionReceiver,
  closeServiceBus,
  QUEUE_NAMES,
  TOPIC_NAMES,
  SUBSCRIPTION_NAMES
};
