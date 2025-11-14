const Redis = require('ioredis');
const Bull = require('bull');
const logger = require('../utils/logger');

// Redis client for general use
let redisClient = null;
let redisAvailable = false;

const initializeRedis = () => {
  try {
    // Check if Redis is disabled in env
    if (process.env.DISABLE_REDIS === 'true') {
      logger.warn('⚠️  Redis is disabled in environment');
      return null;
    }

    // Azure Redis Cache requires TLS and specific connection options
    const redisOptions = {
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT) || 6380,
      password: process.env.REDIS_PASSWORD,
      tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
      maxRetriesPerRequest: null, // Important for cluster mode
      enableReadyCheck: false,
      enableOfflineQueue: true, // IMPORTANT: Allow offline queue while connecting
      connectTimeout: 5000,
      commandTimeout: 5000,
      retryStrategy(times) {
        if (times > 5) {
          logger.warn('⚠️  Redis connection failed - falling back to in-memory mode');
          redisAvailable = false;
          return null; // Stop retrying
        }
        const delay = Math.min(times * 100, 2000);
        return delay;
      },
      reconnectOnError(err) {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
          return true;
        }
        return false;
      }
    };

    redisClient = new Redis(redisOptions);

    redisClient.on('connect', () => {
      logger.info('✅ Redis client connected');
      redisAvailable = true;
    });

    redisClient.on('error', (error) => {
      redisAvailable = false;
      logger.warn('⚠️  Redis connection error (will use in-memory fallback):', error.message);
    });

    redisClient.on('ready', () => {
      logger.info('✅ Redis client ready');
      redisAvailable = true;
    });

    redisClient.on('close', () => {
      redisAvailable = false;
      logger.warn('⚠️  Redis connection closed');
    });

    return redisClient;
  } catch (error) {
    logger.warn('⚠️  Failed to initialize Redis:', error.message);
    redisAvailable = false;
    return null;
  }
};

// Bull Queue for video processing
let videoQueue = null;

const initializeVideoQueue = () => {
  try {
    // Check if Redis is disabled in env
    if (process.env.DISABLE_REDIS === 'true') {
      logger.warn('⚠️  Video queue disabled (Redis disabled in environment)');
      return null;
    }

    // Azure Redis Cache configuration for Bull
    const bullRedisOptions = {
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT) || 6380,
      password: process.env.REDIS_PASSWORD,
      tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      enableOfflineQueue: true, // IMPORTANT: Allow queuing while connecting
      connectTimeout: 10000,
      commandTimeout: 5000
    };

    videoQueue = new Bull('video-processing', bullRedisOptions, {
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        },
        removeOnComplete: 100,
        removeOnFail: 500
      },
      limiter: {
        max: parseInt(process.env.QUEUE_CONCURRENCY) || 5,
        duration: 1000
      }
    });

    videoQueue.on('completed', (job, result) => {
      logger.info(`Job ${job.id} completed successfully`, { result });
    });

    videoQueue.on('failed', (job, error) => {
      logger.error(`Job ${job.id} failed`, { error: error.message });
    });

    videoQueue.on('stalled', (job) => {
      logger.warn(`Job ${job.id} stalled`);
    });

    videoQueue.on('error', (error) => {
      logger.warn('Queue error (non-critical):', { error: error.message || error.toString() });
    });

    logger.info('Video processing queue initialized');
    return videoQueue;
  } catch (error) {
    logger.error('Failed to initialize video queue:', error);
    return null;
  }
};

// Initialize all Redis services
const initializeRedisServices = () => {
  const redis = initializeRedis();
  const queue = initializeVideoQueue();

  return {
    redis,
    videoQueue: queue
  };
};

// Cleanup function
const closeRedisConnections = async () => {
  try {
    if (videoQueue) {
      await videoQueue.close();
      logger.info('Video queue closed');
    }

    if (redisClient) {
      await redisClient.quit();
      logger.info('Redis client disconnected');
    }
  } catch (error) {
    logger.error('Error closing Redis connections:', error);
  }
};

module.exports = {
  initializeRedisServices,
  closeRedisConnections,
  getRedisClient: () => redisClient,
  getVideoQueue: () => videoQueue
};
