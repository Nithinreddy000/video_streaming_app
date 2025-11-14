const logger = require('../utils/logger');

/**
 * CDN Service for Fastly Integration
 *
 * Fastly works as a pull CDN - it automatically caches content from the origin (Azure Blob Storage).
 * We simply need to replace blob URLs with CDN URLs.
 * Supports HLS streaming with proper Content-Type headers.
 */

class CDNService {
  constructor() {
    this.cdnEnabled = process.env.CDN_ENABLED === 'true';
    this.cdnProvider = process.env.CDN_PROVIDER || 'fastly'; // 'fastly' or 'bunny'
    this.cdnHostname = process.env.CDN_HOSTNAME || 'videosentinel.global.ssl.fastly.net';
    this.cdnBaseUrl = process.env.CDN_BASE_URL || `https://${this.cdnHostname}`;
    this.blobBaseUrl = process.env.BLOB_BASE_URL || 'https://videosentinel.blob.core.windows.net/videosentinel-uploads';
  }

  /**
   * Convert Azure Blob URL to CDN URL
   * @param {string} blobUrl - Azure Blob Storage URL
   * @returns {string} CDN URL or original URL if CDN is disabled
   */
  convertToCDNUrl(blobUrl) {
    if (!this.cdnEnabled || !blobUrl) {
      return blobUrl;
    }

    try {
      // Remove query parameters (SAS tokens) from blob URL
      const urlWithoutParams = blobUrl.split('?')[0];

      // Replace blob base URL with CDN base URL
      const cdnUrl = urlWithoutParams.replace(this.blobBaseUrl, this.cdnBaseUrl);

      logger.debug(`Converted blob URL to CDN: ${blobUrl} -> ${cdnUrl}`);
      return cdnUrl;
    } catch (error) {
      logger.error('Error converting to CDN URL:', error);
      return blobUrl;
    }
  }

  /**
   * Convert multiple blob URLs to CDN URLs
   * @param {string[]} blobUrls - Array of blob URLs
   * @returns {string[]} Array of CDN URLs
   */
  convertMultipleToCDNUrls(blobUrls) {
    if (!Array.isArray(blobUrls)) {
      return blobUrls;
    }

    return blobUrls.map(url => this.convertToCDNUrl(url));
  }

  /**
   * Convert video object URLs to CDN URLs
   * @param {object} video - Video object with file URLs
   * @returns {object} Video object with CDN URLs
   */
  convertVideoUrlsToCDN(video) {
    if (!video || !this.cdnEnabled) {
      return video;
    }

    const updatedVideo = { ...video };

    // Convert thumbnail URL
    if (updatedVideo.thumbnail) {
      updatedVideo.thumbnail = this.convertToCDNUrl(updatedVideo.thumbnail);
    }

    // Convert blob URL
    if (updatedVideo.blobUrl) {
      updatedVideo.blobUrl = this.convertToCDNUrl(updatedVideo.blobUrl);
    }

    // Convert processed files URLs
    if (updatedVideo.processedFiles) {
      const processedFiles = { ...updatedVideo.processedFiles };

      // Convert HLS URL
      if (processedFiles.hls) {
        processedFiles.hls = this.convertToCDNUrl(processedFiles.hls);
      }

      // Convert MP4 URLs
      if (processedFiles.mp4) {
        const mp4Files = {};
        Object.keys(processedFiles.mp4).forEach(resolution => {
          mp4Files[resolution] = this.convertToCDNUrl(processedFiles.mp4[resolution]);
        });
        processedFiles.mp4 = mp4Files;
      }

      // Convert thumbnail
      if (processedFiles.thumbnail) {
        processedFiles.thumbnail = this.convertToCDNUrl(processedFiles.thumbnail);
      }

      updatedVideo.processedFiles = processedFiles;
    }

    return updatedVideo;
  }

  /**
   * Get CDN URL for a specific file path
   * @param {string} filePath - Relative file path in blob storage
   * @returns {string} Full CDN URL
   */
  getCDNUrl(filePath) {
    if (!this.cdnEnabled) {
      return `${this.blobBaseUrl}/${filePath}`;
    }

    // Remove leading slash if present
    const cleanPath = filePath.startsWith('/') ? filePath.substring(1) : filePath;

    return `${this.cdnBaseUrl}/${cleanPath}`;
  }

  /**
   * Purge CDN cache for specific URLs (Fastly API integration)
   * Note: This requires Fastly API key and Service ID
   * @param {string|string[]} urls - URL(s) to purge
   */
  async purgeCDNCache(urls) {
    if (!this.cdnEnabled) {
      logger.warn('CDN not enabled, skipping cache purge');
      return;
    }

    const urlArray = Array.isArray(urls) ? urls : [urls];

    logger.info(`CDN cache purge requested for ${urlArray.length} URLs`);

    if (this.cdnProvider === 'fastly') {
      // Fastly cache purging requires API key
      logger.warn('Fastly cache purge not implemented yet. Fastly API integration required.');
      // TODO: Implement Fastly Instant Purge API
      // POST https://api.fastly.com/purge/{url}
      // Header: Fastly-Key: YOUR_API_KEY
    } else {
      logger.warn('CDN cache purge not implemented for provider: ' + this.cdnProvider);
    }
  }

  /**
   * Check if CDN is enabled
   * @returns {boolean}
   */
  isCDNEnabled() {
    return this.cdnEnabled;
  }

  /**
   * Get CDN configuration info
   * @returns {object}
   */
  getCDNConfig() {
    return {
      enabled: this.cdnEnabled,
      hostname: this.cdnHostname,
      baseUrl: this.cdnBaseUrl,
      originUrl: this.blobBaseUrl
    };
  }
}

// Export singleton instance
module.exports = new CDNService();
