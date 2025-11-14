const { getContainerClient } = require('../config/azure');
const cdnService = require('./cdn.service');
const logger = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');

/**
 * Azure Blob Storage Service with CDN Integration
 *
 * Provides methods for uploading, downloading, and managing files in Azure Blob Storage.
 * Automatically converts blob URLs to CDN URLs when CDN is enabled.
 */

/**
 * Get Content-Type based on file extension
 * @param {string} fileName - File name or path
 * @returns {string} MIME type
 */
function getContentType(fileName) {
  const ext = path.extname(fileName).toLowerCase();

  const mimeTypes = {
    // Video formats
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.avi': 'video/x-msvideo',
    '.mov': 'video/quicktime',
    '.mkv': 'video/x-matroska',

    // HLS streaming
    '.m3u8': 'application/x-mpegURL',
    '.ts': 'video/MP2T',

    // DASH streaming
    '.mpd': 'application/dash+xml',

    // Images
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',

    // Documents
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.json': 'application/json',
    '.xml': 'application/xml',

    // Default
    default: 'application/octet-stream'
  };

  return mimeTypes[ext] || mimeTypes.default;
}

class AzureBlobService {
  /**
   * Upload a file to Azure Blob Storage
   * @param {string} localFilePath - Path to local file
   * @param {string} blobName - Blob name in storage
   * @param {object} options - Upload options
   * @returns {Promise<object>} Upload result with URL
   */
  async uploadFile(localFilePath, blobName, options = {}) {
    try {
      const containerClient = getContainerClient();
      if (!containerClient) {
        throw new Error('Azure Blob Storage not initialized');
      }

      const blockBlobClient = containerClient.getBlockBlobClient(blobName);

      // Auto-detect Content-Type if not provided
      const blobHTTPHeaders = options.blobHTTPHeaders || {};
      if (!blobHTTPHeaders.blobContentType) {
        blobHTTPHeaders.blobContentType = getContentType(blobName);
        logger.info(`Auto-detected Content-Type for ${blobName}: ${blobHTTPHeaders.blobContentType}`);
      }

      // Upload file
      const uploadResponse = await blockBlobClient.uploadFile(localFilePath, {
        blobHTTPHeaders,
        metadata: options.metadata || {}
      });

      // Get blob URL
      const blobUrl = blockBlobClient.url;

      // Convert to CDN URL
      const cdnUrl = cdnService.convertToCDNUrl(blobUrl);

      logger.info(`File uploaded successfully: ${blobName}`);

      return {
        success: true,
        blobName,
        blobUrl,
        cdnUrl,
        etag: uploadResponse.etag,
        lastModified: uploadResponse.lastModified
      };
    } catch (error) {
      logger.error(`Failed to upload file ${blobName}:`, error);
      throw error;
    }
  }

  /**
   * Upload buffer to Azure Blob Storage
   * @param {Buffer} buffer - File buffer
   * @param {string} blobName - Blob name in storage
   * @param {object} options - Upload options
   * @returns {Promise<object>} Upload result with URL
   */
  async uploadBuffer(buffer, blobName, options = {}) {
    try {
      const containerClient = getContainerClient();
      if (!containerClient) {
        throw new Error('Azure Blob Storage not initialized');
      }

      const blockBlobClient = containerClient.getBlockBlobClient(blobName);

      // Auto-detect Content-Type if not provided
      const blobHTTPHeaders = options.blobHTTPHeaders || {};
      if (!blobHTTPHeaders.blobContentType) {
        blobHTTPHeaders.blobContentType = getContentType(blobName);
        logger.info(`Auto-detected Content-Type for ${blobName}: ${blobHTTPHeaders.blobContentType}`);
      }

      // Upload buffer
      const uploadResponse = await blockBlobClient.upload(buffer, buffer.length, {
        blobHTTPHeaders,
        metadata: options.metadata || {}
      });

      // Get blob URL
      const blobUrl = blockBlobClient.url;

      // Convert to CDN URL
      const cdnUrl = cdnService.convertToCDNUrl(blobUrl);

      logger.info(`Buffer uploaded successfully: ${blobName}`);

      return {
        success: true,
        blobName,
        blobUrl,
        cdnUrl,
        etag: uploadResponse.etag,
        lastModified: uploadResponse.lastModified
      };
    } catch (error) {
      logger.error(`Failed to upload buffer ${blobName}:`, error);
      throw error;
    }
  }

  /**
   * Download a file from Azure Blob Storage
   * @param {string} blobName - Blob name in storage
   * @param {string} downloadPath - Local path to save file
   * @returns {Promise<boolean>} Success status
   */
  async downloadFile(blobName, downloadPath) {
    try {
      const containerClient = getContainerClient();
      if (!containerClient) {
        throw new Error('Azure Blob Storage not initialized');
      }

      const blockBlobClient = containerClient.getBlockBlobClient(blobName);

      // Ensure directory exists
      await fs.mkdir(path.dirname(downloadPath), { recursive: true });

      // Download file
      await blockBlobClient.downloadToFile(downloadPath);

      logger.info(`File downloaded successfully: ${blobName} -> ${downloadPath}`);
      return true;
    } catch (error) {
      logger.error(`Failed to download file ${blobName}:`, error);
      throw error;
    }
  }

  /**
   * Download blob as buffer
   * @param {string} blobUrl - Blob URL or name
   * @param {string} localPath - Local path to save
   * @returns {Promise<void>}
   */
  async downloadFromBlob(blobUrl, localPath) {
    try {
      const containerClient = getContainerClient();
      if (!containerClient) {
        throw new Error('Azure Blob Storage not initialized');
      }

      // Extract blob name from URL if full URL provided
      let blobName = blobUrl;
      if (blobUrl.includes('blob.core.windows.net')) {
        const urlParts = blobUrl.split('/');
        blobName = urlParts.slice(4).join('/').split('?')[0];
      }

      // Ensure directory exists
      await fs.mkdir(path.dirname(localPath), { recursive: true });

      // Download directly using a new client to avoid 'this' binding issues
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);
      await blockBlobClient.downloadToFile(localPath);
    } catch (error) {
      logger.error(`Failed to download from blob ${blobUrl}:`, error);
      throw error;
    }
  }

  /**
   * Upload to blob storage
   * @param {string} localPath - Local file path
   * @param {string} blobPath - Blob path
   * @returns {Promise<string>} CDN URL
   */
  async uploadToBlob(localPath, blobPath) {
    try {
      const result = await this.uploadFile(localPath, blobPath);
      return result.cdnUrl || result.blobUrl;
    } catch (error) {
      logger.error(`Failed to upload to blob ${blobPath}:`, error);
      throw error;
    }
  }

  /**
   * Delete a blob from storage
   * @param {string} blobName - Blob name to delete
   * @returns {Promise<boolean>} Success status
   */
  async deleteBlob(blobName) {
    try {
      const containerClient = getContainerClient();
      if (!containerClient) {
        throw new Error('Azure Blob Storage not initialized');
      }

      const blockBlobClient = containerClient.getBlockBlobClient(blobName);
      await blockBlobClient.delete();

      logger.info(`Blob deleted successfully: ${blobName}`);
      return true;
    } catch (error) {
      logger.error(`Failed to delete blob ${blobName}:`, error);
      throw error;
    }
  }

  /**
   * Check if blob exists
   * @param {string} blobName - Blob name
   * @returns {Promise<boolean>} Exists status
   */
  async blobExists(blobName) {
    try {
      const containerClient = getContainerClient();
      if (!containerClient) {
        return false;
      }

      const blockBlobClient = containerClient.getBlockBlobClient(blobName);
      return await blockBlobClient.exists();
    } catch (error) {
      logger.error(`Failed to check blob existence ${blobName}:`, error);
      return false;
    }
  }

  /**
   * Get blob properties
   * @param {string} blobName - Blob name
   * @returns {Promise<object>} Blob properties
   */
  async getBlobProperties(blobName) {
    try {
      const containerClient = getContainerClient();
      if (!containerClient) {
        throw new Error('Azure Blob Storage not initialized');
      }

      const blockBlobClient = containerClient.getBlockBlobClient(blobName);
      const properties = await blockBlobClient.getProperties();

      return {
        contentLength: properties.contentLength,
        contentType: properties.contentType,
        lastModified: properties.lastModified,
        etag: properties.etag,
        metadata: properties.metadata
      };
    } catch (error) {
      logger.error(`Failed to get blob properties ${blobName}:`, error);
      throw error;
    }
  }

  /**
   * List blobs in container with optional prefix
   * @param {string} prefix - Blob name prefix filter
   * @returns {Promise<Array>} Array of blob names
   */
  async listBlobs(prefix = '') {
    try {
      const containerClient = getContainerClient();
      if (!containerClient) {
        throw new Error('Azure Blob Storage not initialized');
      }

      const blobs = [];
      for await (const blob of containerClient.listBlobsFlat({ prefix })) {
        blobs.push({
          name: blob.name,
          properties: blob.properties,
          blobUrl: `${containerClient.url}/${blob.name}`,
          cdnUrl: cdnService.convertToCDNUrl(`${containerClient.url}/${blob.name}`)
        });
      }

      return blobs;
    } catch (error) {
      logger.error('Failed to list blobs:', error);
      throw error;
    }
  }

  /**
   * Generate SAS URL for blob (short-lived access)
   * @param {string} blobName - Blob name
   * @param {number} expiryMinutes - Expiry time in minutes
   * @returns {Promise<string>} SAS URL
   */
  async generateSASUrl(blobName, expiryMinutes = 60) {
    try {
      const containerClient = getContainerClient();
      if (!containerClient) {
        throw new Error('Azure Blob Storage not initialized');
      }

      const { BlobSASPermissions, generateBlobSASQueryParameters } = require('@azure/storage-blob');
      const { DefaultAzureCredential } = require('@azure/identity');

      const blockBlobClient = containerClient.getBlockBlobClient(blobName);

      const permissions = new BlobSASPermissions();
      permissions.read = true;

      const startsOn = new Date();
      const expiresOn = new Date(startsOn.getTime() + expiryMinutes * 60 * 1000);

      const sasToken = generateBlobSASQueryParameters({
        containerName: containerClient.containerName,
        blobName,
        permissions,
        startsOn,
        expiresOn
      }, new DefaultAzureCredential());

      const sasUrl = `${blockBlobClient.url}?${sasToken}`;

      logger.info(`SAS URL generated for ${blobName} (expires in ${expiryMinutes} minutes)`);
      return sasUrl;
    } catch (error) {
      logger.error(`Failed to generate SAS URL for ${blobName}:`, error);
      // Fallback to regular URL
      const containerClient = getContainerClient();
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);
      return blockBlobClient.url;
    }
  }

  /**
   * Get blob stream for streaming with range support
   * @param {string} blobUrlOrName - Blob URL or name
   * @param {number} start - Start byte position (optional)
   * @param {number} end - End byte position (optional)
   * @returns {Promise<ReadableStream>} Readable stream
   */
  async getFileStream(blobUrlOrName, start = null, end = null) {
    try {
      const containerClient = getContainerClient();
      if (!containerClient) {
        throw new Error('Azure Blob Storage not initialized');
      }

      // Extract blob name from URL if full URL provided
      let blobName = blobUrlOrName;
      if (blobUrlOrName.includes('blob.core.windows.net')) {
        const urlParts = blobUrlOrName.split('/');
        blobName = urlParts.slice(4).join('/').split('?')[0];
      }

      const blockBlobClient = containerClient.getBlockBlobClient(blobName);

      // Download blob with range if specified
      const downloadOptions = {};
      if (start !== null && end !== null) {
        downloadOptions.range = { offset: start, count: end - start + 1 };
      }

      const downloadResponse = await blockBlobClient.download(0, undefined, downloadOptions);

      logger.info(`Streaming blob: ${blobName} ${start !== null ? `(${start}-${end})` : ''}`);
      return downloadResponse.readableStreamBody;
    } catch (error) {
      logger.error(`Failed to get file stream for ${blobUrlOrName}:`, error);
      throw error;
    }
  }

  /**
   * Delete a file from blob storage (alias for deleteBlob)
   * @param {string} blobUrlOrName - Blob URL or name
   * @returns {Promise<boolean>} Success status
   */
  async deleteFile(blobUrlOrName) {
    try {
      // Extract blob name from URL if full URL provided
      let blobName = blobUrlOrName;
      if (blobUrlOrName.includes('blob.core.windows.net')) {
        const urlParts = blobUrlOrName.split('/');
        blobName = urlParts.slice(4).join('/').split('?')[0];
      }

      return await this.deleteBlob(blobName);
    } catch (error) {
      logger.error(`Failed to delete file ${blobUrlOrName}:`, error);
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new AzureBlobService();
