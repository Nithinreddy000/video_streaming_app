const { BlobServiceClient } = require('@azure/storage-blob');
const ContentSafetyClient = require('@azure-rest/ai-content-safety').default;
const { AzureKeyCredential } = require('@azure/core-auth');
const logger = require('../utils/logger');

// Azure Blob Storage Client
let blobServiceClient = null;
let containerClient = null;

const initializeBlobStorage = () => {
  try {
    if (!process.env.AZURE_STORAGE_CONNECTION_STRING) {
      logger.warn('Azure Blob Storage connection string not configured');
      return null;
    }

    blobServiceClient = BlobServiceClient.fromConnectionString(
      process.env.AZURE_STORAGE_CONNECTION_STRING
    );

    containerClient = blobServiceClient.getContainerClient(
      process.env.AZURE_STORAGE_CONTAINER_NAME
    );

    logger.info('Azure Blob Storage client initialized');
    return containerClient;
  } catch (error) {
    logger.error('Failed to initialize Azure Blob Storage:', error);
    return null;
  }
};

// Azure AI Content Safety Client
let contentSafetyClient = null;

const initializeContentSafety = () => {
  try {
    if (!process.env.AZURE_CONTENT_SAFETY_ENDPOINT || !process.env.AZURE_CONTENT_SAFETY_KEY) {
      logger.warn('Azure AI Content Safety credentials not configured');
      return null;
    }

    contentSafetyClient = ContentSafetyClient(
      process.env.AZURE_CONTENT_SAFETY_ENDPOINT,
      new AzureKeyCredential(process.env.AZURE_CONTENT_SAFETY_KEY)
    );

    logger.info('Azure AI Content Safety client initialized');
    return contentSafetyClient;
  } catch (error) {
    logger.error('Failed to initialize Azure AI Content Safety:', error);
    return null;
  }
};

// Initialize all Azure services
const initializeAzureServices = async () => {
  const blob = initializeBlobStorage();
  const contentSafety = initializeContentSafety();

  // Create container if it doesn't exist
  if (containerClient) {
    try {
      // Note: 'blob' allows public read access to blobs, 'container' is private
      // Since we're using SAS tokens for secure access, we don't need public access
      await containerClient.createIfNotExists();
      logger.info(`✅ Container "${process.env.AZURE_STORAGE_CONTAINER_NAME}" ready`);
    } catch (error) {
      logger.warn('⚠️  Container creation/verification skipped (may already exist):', error.message);
    }
  }

  return {
    blobStorage: blob,
    contentSafety
  };
};

module.exports = {
  initializeAzureServices,
  getBlobServiceClient: () => blobServiceClient,
  getContainerClient: () => containerClient,
  getContentSafetyClient: () => contentSafetyClient
};
