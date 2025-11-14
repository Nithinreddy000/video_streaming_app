const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
  try {
    logger.info('Connecting to MongoDB Atlas...');

    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }

    const options = {
      maxPoolSize: parseInt(process.env.DB_POOL_SIZE) || 10,
      serverSelectionTimeoutMS: 30000, // Increased to 30 seconds
      socketTimeoutMS: 45000,
      connectTimeoutMS: 30000,
    };

    logger.info('MongoDB connection options:', {
      maxPoolSize: options.maxPoolSize,
      serverSelectionTimeoutMS: options.serverSelectionTimeoutMS
    });

    await mongoose.connect(process.env.MONGODB_URI, options);

    logger.info('✅ MongoDB Atlas connected successfully');

    // Connection event handlers
    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed through app termination');
      process.exit(0);
    });

  } catch (error) {
    logger.error('❌ MongoDB connection failed:', {
      message: error.message,
      name: error.name,
      code: error.code,
      stack: error.stack
    });
    throw error; // Re-throw to be caught by initializeServices
  }
};

module.exports = connectDB;
