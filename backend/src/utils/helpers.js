const path = require('path');
const crypto = require('crypto');

/**
 * Generate a unique filename with timestamp and random string
 * @param {string} originalName - Original filename
 * @returns {string} Unique filename
 */
const generateUniqueFileName = (originalName) => {
  const timestamp = Date.now();
  const randomString = crypto.randomBytes(8).toString('hex');
  const ext = path.extname(originalName);
  const nameWithoutExt = path.basename(originalName, ext);
  return `${nameWithoutExt}-${timestamp}-${randomString}${ext}`;
};

/**
 * Format bytes to human-readable size
 * @param {number} bytes - Size in bytes
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted size string
 */
const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

/**
 * Format duration in seconds to HH:MM:SS
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration
 */
const formatDuration = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  return [h, m, s]
    .map(v => v < 10 ? '0' + v : v)
    .filter((v, i) => v !== '00' || i > 0)
    .join(':');
};

/**
 * Sanitize filename by removing special characters
 * @param {string} filename - Original filename
 * @returns {string} Sanitized filename
 */
const sanitizeFilename = (filename) => {
  return filename
    .replace(/[^a-z0-9.-]/gi, '_')
    .replace(/_{2,}/g, '_')
    .toLowerCase();
};

/**
 * Calculate percentage
 * @param {number} current - Current value
 * @param {number} total - Total value
 * @returns {number} Percentage (0-100)
 */
const calculatePercentage = (current, total) => {
  if (total === 0) return 0;
  return Math.min(Math.round((current / total) * 100), 100);
};

/**
 * Check if value is within limit (-1 means unlimited)
 * @param {number} current - Current value
 * @param {number} limit - Limit value
 * @returns {boolean} True if within limit
 */
const isWithinLimit = (current, limit) => {
  if (limit === -1) return true; // Unlimited
  return current < limit;
};

/**
 * Generate a random string
 * @param {number} length - Length of the string
 * @returns {string} Random string
 */
const generateRandomString = (length = 32) => {
  return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
};

/**
 * Paginate results
 * @param {number} page - Page number (1-indexed)
 * @param {number} limit - Items per page
 * @returns {object} Skip and limit values
 */
const paginate = (page = 1, limit = 20) => {
  const p = Math.max(1, parseInt(page));
  const l = Math.min(100, Math.max(1, parseInt(limit)));
  return {
    skip: (p - 1) * l,
    limit: l,
    page: p
  };
};

/**
 * Build sort object from query parameters
 * @param {string} sortBy - Field to sort by
 * @param {string} sortOrder - Sort order (asc/desc)
 * @returns {object} Sort object
 */
const buildSortObject = (sortBy = 'createdAt', sortOrder = 'desc') => {
  const order = sortOrder === 'asc' ? 1 : -1;
  return { [sortBy]: order };
};

/**
 * Delay execution
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise} Promise that resolves after delay
 */
const delay = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} baseDelay - Base delay in milliseconds
 * @returns {Promise} Promise that resolves with function result
 */
const retryWithBackoff = async (fn, maxRetries = 3, baseDelay = 1000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      const delayTime = baseDelay * Math.pow(2, i);
      await delay(delayTime);
    }
  }
};

/**
 * Parse time string to milliseconds
 * @param {string} timeStr - Time string (e.g., '15m', '7d', '1h')
 * @returns {number} Milliseconds
 */
const parseTimeToMs = (timeStr) => {
  const units = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000
  };

  const match = timeStr.match(/^(\d+)([smhd]|ms)$/);
  if (!match) throw new Error(`Invalid time format: ${timeStr}`);

  const [, value, unit] = match;
  return parseInt(value) * units[unit];
};

module.exports = {
  generateUniqueFileName,
  formatBytes,
  formatDuration,
  sanitizeFilename,
  calculatePercentage,
  isWithinLimit,
  generateRandomString,
  paginate,
  buildSortObject,
  delay,
  retryWithBackoff,
  parseTimeToMs
};
