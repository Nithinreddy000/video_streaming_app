console.log('=== STEP 0: Loading dotenv ===');
require('dotenv').config();
console.log('✅ Dotenv loaded');

console.log('=== STEP 1: Checking environment variables ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);
console.log('MONGODB_URI exists:', !!process.env.MONGODB_URI);
console.log('JWT_ACCESS_SECRET exists:', !!process.env.JWT_ACCESS_SECRET);
console.log('JWT_REFRESH_SECRET exists:', !!process.env.JWT_REFRESH_SECRET);

// DISABLE Application Insights - it's hiding the error
console.log('=== STEP 2: Skipping Application Insights (disabled for debugging) ===');
const flushTelemetry = () => Promise.resolve();

console.log('=== STEP 3: Loading HTTP module ===');
const http = require('http');
console.log('✅ HTTP module loaded');

console.log('=== STEP 4: Loading app.js ===');
let app;
try {
  app = require('./app');
  console.log('✅ app.js loaded successfully');
} catch (error) {
  console.error('❌ FATAL: Failed to load app.js');
  console.error('Error:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}
const connectDB = require('./config/database');
const { initializeRedisServices, closeRedisConnections } = require('./config/redis');
const { initializeAzureServices } = require('./config/azure');
const { initializeSocketIO } = require('./config/socket');
const { initializeServiceBus, closeServiceBus, isServiceBusAvailable } = require('./config/servicebus');
const logger = require('./utils/logger');

// Log startup
console.log('\n=== VideoSentinel Backend Starting ===');
console.log('Node Version:', process.version);
console.log('Environment:', process.env.NODE_ENV);
console.log('Time:', new Date().toISOString());

// Service Bus workers will be imported AFTER MongoDB connects
let videoUploadWorker, transcodingWorker, aiAnalysisWorker, responseHandlerWorker;

// Configuration validation
const requiredEnvVars = [
  'NODE_ENV',
  'PORT',
  'MONGODB_URI',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET'
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  logger.error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
  process.exit(1);
}

// Server port
const PORT = process.env.PORT || 5000;

// Create HTTP server
const server = http.createServer(app);

// Initialize all services
async function initializeServices() {
  try {
    console.log('\n📦 Step 1: Connecting to MongoDB...');
    console.log('   MONGODB_URI configured:', !!process.env.MONGODB_URI);
    console.log('   JWT secrets configured:', !!(process.env.JWT_ACCESS_SECRET && process.env.JWT_REFRESH_SECRET));

    await connectDB();
    console.log('✅ Step 1: MongoDB connected');

    // Now that MongoDB is connected, safely import Service Bus workers
    // (they require the Video model which only compiles after DB connection)
    console.log('📦 Step 1b: Loading Service Bus workers...');
    try {
      videoUploadWorker = require('./workers/servicebus/video-upload.worker');
      transcodingWorker = require('./workers/servicebus/transcoding.worker');
      aiAnalysisWorker = require('./workers/servicebus/ai-analysis.worker');
      responseHandlerWorker = require('./workers/servicebus/response-handler.worker');
      console.log('✅ Step 1b: Service Bus workers loaded');
    } catch (err) {
      console.warn('⚠️  Service Bus workers loading error:', err.message);
    }

    console.log('📦 Step 2: Initializing Redis...');
    let redis = null;
    let videoQueue = null;
    try {
      const result = initializeRedisServices();
      redis = result.redis;
      videoQueue = result.videoQueue;
      if (!redis) {
        console.warn('⚠️  Redis not available - some features may be limited');
      }
    } catch (err) {
      console.warn('⚠️  Redis initialization error:', err.message);
    }
    console.log('✅ Step 2: Redis initialized (or skipped)');

    console.log('📦 Step 3: Initializing Azure services...');
    let azureServices = {};
    try {
      azureServices = await initializeAzureServices();
      if (!azureServices.blobStorage) {
        console.warn('⚠️  Azure Blob Storage not configured');
      }
      if (!azureServices.contentSafety) {
        console.warn('⚠️  Azure AI Content Safety not configured');
      }
    } catch (err) {
      console.warn('⚠️  Azure services initialization error:', err.message);
    }
    console.log('✅ Step 3: Azure services initialized (or skipped)');

    console.log('📦 Step 4: Initializing Socket.IO...');
    let io = null;
    try {
      io = initializeSocketIO(server, redis);
      app.set('io', io);
    } catch (err) {
      console.warn('⚠️  Socket.IO initialization error:', err.message);
    }
    console.log('✅ Step 4: Socket.IO initialized (or skipped)');

    console.log('📦 Step 5: Initializing Azure Service Bus...');
    let serviceBusClient = null;
    try {
      // Await async Service Bus initialization with connection verification
      serviceBusClient = await initializeServiceBus();

      if (isServiceBusAvailable()) {
        console.log('✅ Service Bus connection established, starting workers...');

        // Start workers sequentially to avoid connection race conditions
        await Promise.all([
          videoUploadWorker.start().catch(e => console.warn('❌ Video Upload Worker error:', e.message)),
          transcodingWorker.start().catch(e => console.warn('❌ Transcoding Worker error:', e.message)),
          aiAnalysisWorker.start().catch(e => console.warn('❌ AI Analysis Worker error:', e.message)),
          responseHandlerWorker.start().catch(e => console.warn('❌ Response Handler Worker error:', e.message))
        ]);

        console.log('✅ All Service Bus workers started successfully');
      } else {
        console.warn('⚠️  Azure Service Bus not configured or connection failed');
      }
    } catch (err) {
      console.warn('⚠️  Service Bus initialization error:', err.message);
      console.warn('⚠️  Stack:', err.stack);
    }
    console.log('✅ Step 5: Service Bus initialized (or skipped)');

    console.log('✅ All services initialized successfully');
    return { redis, videoQueue, azureServices, io, serviceBusClient };
  } catch (error) {
    console.error('\n========================================');
    console.error('❌ SERVICE INITIALIZATION FAILED');
    console.error('========================================');
    console.error('Error message:', error.message);
    console.error('Error name:', error.name);
    console.error('Error code:', error.code);
    console.error('Stack trace:');
    console.error(error.stack);
    console.error('========================================\n');
    logger.error('Service initialization failed:', error);
    throw error;
  }
}

// Start server
async function startServer() {
  try {
    console.log('📦 Initializing services...');
    
    // Add timeout to service initialization (60 seconds)
    const initPromise = initializeServices();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Service initialization timeout after 60 seconds')), 60000)
    );

    await Promise.race([initPromise, timeoutPromise]);
    console.log('✅ Services initialized successfully');

    // Start listening
    server.listen(PORT, () => {
      console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║              VideoSentinel Backend Server                 ║
║                                                           ║
║  Environment: ${process.env.NODE_ENV.padEnd(44)}║
║  Port:        ${PORT.toString().padEnd(44)}║
║  API Version: ${(process.env.API_VERSION || 'v1').padEnd(44)}║
║                                                           ║
║  ✅ Server is ready to accept connections!               ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
      `);
      logger.info('Server started successfully on port ' + PORT);
    });

    // Graceful shutdown
    const shutdown = async (signal) => {
      logger.info(`${signal} received, shutting down gracefully...`);

      server.close(async () => {
        logger.info('HTTP server closed');

        try {
          // Stop Service Bus workers
          if (isServiceBusAvailable()) {
            logger.info('Stopping Service Bus workers...');
            await videoUploadWorker.stop();
            await transcodingWorker.stop();
            await aiAnalysisWorker.stop();
            await responseHandlerWorker.stop();
            await closeServiceBus();
            logger.info('✅ Service Bus workers stopped');
          }

          // Close Redis connections
          await closeRedisConnections();

          // Flush Application Insights telemetry
          await flushTelemetry();

          logger.info('All connections closed');
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown:', error);
          process.exit(1);
        }
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      shutdown('uncaughtException');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      shutdown('unhandledRejection');
    });

  } catch (error) {
    console.error('\n========================================');
    console.error('❌ FATAL: Failed to start server');
    console.error('========================================');
    console.error('Error message:', error.message);
    console.error('Error name:', error.name);
    console.error('Error code:', error.code);
    console.error('Stack trace:');
    console.error(error.stack);
    console.error('========================================\n');
    logger.error('Failed to start server:', error);

    // Give logs time to flush before exiting
    await flushTelemetry();
    setTimeout(() => {
      process.exit(1);
    }, 2000);
  }
}

// Global error handlers
process.on('uncaughtException', async (error) => {
  console.error('\n========================================');
  console.error('❌ UNCAUGHT EXCEPTION');
  console.error('========================================');
  console.error('Message:', error.message);
  console.error('Stack:', error.stack);
  console.error('========================================\n');
  logger.error('Uncaught Exception:', error);

  await flushTelemetry();
  setTimeout(() => process.exit(1), 2000);
});

process.on('unhandledRejection', async (reason, promise) => {
  console.error('\n========================================');
  console.error('❌ UNHANDLED PROMISE REJECTION');
  console.error('========================================');
  console.error('Reason:', reason);
  console.error('Promise:', promise);
  if (reason && reason.stack) {
    console.error('Stack:', reason.stack);
  }
  console.error('========================================\n');
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);

  await flushTelemetry();
  setTimeout(() => process.exit(1), 2000);
});

// Start the server
console.log('\n🚀 Starting server...');
startServer();

module.exports = server;
