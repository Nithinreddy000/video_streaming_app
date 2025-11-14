const { getContentSafetyClient } = require('../config/azure');
const azureBlobService = require('./azure-blob.service');
const logger = require('../utils/logger');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs').promises;

// Set FFmpeg path explicitly for Alpine Linux
try {
  ffmpeg.setFfmpegPath('/usr/bin/ffmpeg');
  ffmpeg.setFfprobePath('/usr/bin/ffprobe');
} catch (error) {
  logger.warn('FFmpeg path configuration warning:', error.message);
}

/**
 * Azure AI Content Safety Service
 *
 * Provides video content moderation using Azure AI Content Safety API.
 * Analyzes videos by extracting frames and analyzing them with image endpoint.
 */

class AzureAIService {
  /**
   * Extract frames from video using FFmpeg
   * @param {string} videoPath - Local path to video file
   * @param {number} frameCount - Number of frames to extract
   * @returns {Promise<string[]>} Array of frame file paths
   */
  async extractFrames(videoPath, frameCount = 5) {
    const outputDir = path.join(path.dirname(videoPath), 'frames');
    await fs.mkdir(outputDir, { recursive: true });

    const framePaths = [];

    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, async (err, metadata) => {
        if (err) return reject(err);

        const duration = metadata.format.duration;
        const interval = duration / (frameCount + 1);

        try {
          // Extract frames at evenly spaced intervals
          for (let i = 1; i <= frameCount; i++) {
            const timestamp = interval * i;
            const framePath = path.join(outputDir, `frame_${i}.jpg`);

            await new Promise((res, rej) => {
              ffmpeg(videoPath)
                .seekInput(timestamp)
                .frames(1)
                .output(framePath)
                .on('end', () => {
                  framePaths.push(framePath);
                  res();
                })
                .on('error', rej)
                .run();
            });
          }

          logger.info(`✅ Extracted ${frameCount} frames from video`);
          resolve(framePaths);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  /**
   * Analyze video content for safety by extracting and analyzing frames
   * @param {string} videoUrl - URL to video file
   * @returns {Promise<object>} Analysis results
   */
  async analyzeVideoContent(videoUrl) {
    let localVideoPath = null;
    let framePaths = [];

    try {
      logger.info(`Analyzing video content via frame extraction: ${videoUrl}`);

      // Download video temporarily
      const videoId = Date.now();
      localVideoPath = path.join(__dirname, '../../temp', `${videoId}_analysis.mp4`);

      await azureBlobService.downloadFromBlob(videoUrl, localVideoPath);
      logger.info(`✅ Video downloaded for analysis: ${localVideoPath}`);

      // Extract frames (5 frames evenly distributed through the video)
      framePaths = await this.extractFrames(localVideoPath, 5);

      // Upload frames to blob storage for Content Safety analysis
      const frameUrls = [];
      for (let i = 0; i < framePaths.length; i++) {
        const framePath = framePaths[i];
        const blobPath = `analysis-frames/${videoId}/frame_${i}.jpg`;

        const result = await azureBlobService.uploadFile(framePath, blobPath);
        frameUrls.push(result.cdnUrl || result.blobUrl);
      }

      logger.info(`✅ Uploaded ${frameUrls.length} frames for analysis`);

      // Analyze each frame with Azure Content Safety
      const frameAnalyses = await Promise.all(
        frameUrls.map(url => this.analyzeImageContent(url))
      );

      // Aggregate results across all frames
      const aggregatedResult = this.aggregateFrameAnalyses(frameAnalyses);

      logger.info(`✅ Video analysis completed: Overall score ${aggregatedResult.overallScore}`);

      // Cleanup temporary files
      await this.cleanupAnalysisFiles(localVideoPath, framePaths);

      return aggregatedResult;
    } catch (error) {
      logger.error('Failed to analyze video content:', error);

      // Cleanup on error
      try {
        await this.cleanupAnalysisFiles(localVideoPath, framePaths);
      } catch (cleanupError) {
        logger.warn('Failed to cleanup analysis files:', cleanupError);
      }

      // Return safe mock data if analysis fails
      if (process.env.NODE_ENV === 'development') {
        logger.warn('Returning mock safe analysis result due to error');
        return {
          categories: [
            { name: 'hate', severity: 0 },
            { name: 'self-harm', severity: 0 },
            { name: 'sexual', severity: 0 },
            { name: 'violence', severity: 0 }
          ],
          overallScore: 0
        };
      }

      throw error;
    }
  }

  /**
   * Aggregate frame analysis results into overall video score
   * @param {Array} frameAnalyses - Array of frame analysis results
   * @returns {object} Aggregated analysis
   */
  aggregateFrameAnalyses(frameAnalyses) {
    // Take the maximum severity for each category across all frames
    const categories = {
      hate: 0,
      'self-harm': 0,
      sexual: 0,
      violence: 0
    };

    frameAnalyses.forEach(analysis => {
      analysis.categories.forEach(cat => {
        if (cat.severity > categories[cat.name]) {
          categories[cat.name] = cat.severity;
        }
      });
    });

    const categoriesArray = Object.entries(categories).map(([name, severity]) => ({
      name,
      severity
    }));

    const overallScore = Math.max(...Object.values(categories));

    return {
      categories: categoriesArray,
      overallScore,
      framesAnalyzed: frameAnalyses.length
    };
  }

  /**
   * Cleanup temporary analysis files
   * @param {string} videoPath - Video file path
   * @param {string[]} framePaths - Array of frame file paths
   */
  async cleanupAnalysisFiles(videoPath, framePaths) {
    try {
      // Delete video file
      if (videoPath) {
        await fs.unlink(videoPath).catch(() => {});
      }

      // Delete frame files
      for (const framePath of framePaths) {
        await fs.unlink(framePath).catch(() => {});
      }

      // Delete frames directory
      if (framePaths.length > 0) {
        const framesDir = path.dirname(framePaths[0]);
        await fs.rm(framesDir, { recursive: true, force: true }).catch(() => {});
      }

      logger.info('🧹 Cleaned up analysis temporary files');
    } catch (error) {
      logger.warn('⚠️ Failed to cleanup some analysis files:', error);
    }
  }

  /**
   * Calculate overall safety score from category results
   * @param {object} result - Azure API result
   * @returns {number} Overall score (0-6)
   */
  calculateOverallScore(result) {
    const scores = [
      result.hateResult?.severity || 0,
      result.selfHarmResult?.severity || 0,
      result.sexualResult?.severity || 0,
      result.violenceResult?.severity || 0
    ];

    // Return maximum severity as overall score
    return Math.max(...scores);
  }

  /**
   * Analyze image content for safety
   * @param {string} imageUrl - URL to image file
   * @returns {Promise<object>} Analysis results
   */
  async analyzeImageContent(imageUrl) {
    try {
      const axios = require('axios');

      const endpoint = process.env.AZURE_COMPUTER_VISION_ENDPOINT;
      const key = process.env.AZURE_COMPUTER_VISION_KEY;

      if (!endpoint || !key) {
        throw new Error('Azure Computer Vision not configured');
      }

      logger.info(`Analyzing image content with Computer Vision: ${imageUrl}`);

      // Call Azure Computer Vision API v3.2 for adult content detection
      const response = await axios.post(
        `${endpoint}/vision/v3.2/analyze?visualFeatures=Adult`,
        { url: imageUrl },
        {
          headers: {
            'Ocp-Apim-Subscription-Key': key,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      const result = response.data;

      // Map Computer Vision response to our format
      // Computer Vision provides scores 0.0-1.0, we convert to severity 0-6
      const adultScore = result.adult?.adultScore || 0;
      const racyScore = result.adult?.racyScore || 0;
      const goreScore = result.adult?.goreScore || 0;

      // Convert scores to severity levels (0, 2, 4, 6)
      const toSeverity = (score) => {
        if (score < 0.25) return 0; // Safe
        if (score < 0.50) return 2; // Low
        if (score < 0.75) return 4; // Medium
        return 6; // High
      };

      const analysis = {
        categories: [
          {
            name: 'hate',
            severity: 0 // Computer Vision doesn't detect hate, default to safe
          },
          {
            name: 'self-harm',
            severity: toSeverity(goreScore) // Use gore as proxy for self-harm
          },
          {
            name: 'sexual',
            severity: Math.max(toSeverity(adultScore), toSeverity(racyScore))
          },
          {
            name: 'violence',
            severity: toSeverity(goreScore)
          }
        ],
        overallScore: Math.max(adultScore, racyScore, goreScore),
        isAdultContent: result.adult?.isAdultContent || false,
        isRacyContent: result.adult?.isRacyContent || false,
        isGoryContent: result.adult?.isGoryContent || false
      };

      logger.info(`✅ Computer Vision analysis completed: ${imageUrl} - Overall score ${analysis.overallScore.toFixed(4)}`);

      return analysis;
    } catch (error) {
      logger.error('Failed to analyze image content:', error);

      // Return safe mock data if API fails
      if (process.env.NODE_ENV === 'development') {
        logger.warn('Returning mock safe analysis result due to API error');
        return {
          categories: [
            { name: 'hate', severity: 0 },
            { name: 'self-harm', severity: 0 },
            { name: 'sexual', severity: 0 },
            { name: 'violence', severity: 0 }
          ],
          overallScore: 0
        };
      }

      throw error;
    }
  }

  /**
   * Analyze text content for safety
   * @param {string} text - Text content to analyze
   * @returns {Promise<object>} Analysis results
   */
  async analyzeTextContent(text) {
    try {
      const client = getContentSafetyClient();
      if (!client) {
        throw new Error('Azure AI Content Safety not initialized');
      }

      logger.info('Analyzing text content');

      const response = await client.path('/text:analyze').post({
        body: {
          text,
          categories: ['Hate', 'SelfHarm', 'Sexual', 'Violence'],
          outputType: 'FourSeverityLevels'
        }
      });

      if (response.status !== '200') {
        throw new Error(`Content Safety API error: ${response.status}`);
      }

      const result = response.body;

      const analysis = {
        categories: [
          {
            name: 'hate',
            severity: result.hateResult?.severity || 0
          },
          {
            name: 'self-harm',
            severity: result.selfHarmResult?.severity || 0
          },
          {
            name: 'sexual',
            severity: result.sexualResult?.severity || 0
          },
          {
            name: 'violence',
            severity: result.violenceResult?.severity || 0
          }
        ],
        overallScore: this.calculateOverallScore(result)
      };

      logger.info('Text analysis completed');

      return analysis;
    } catch (error) {
      logger.error('Failed to analyze text content:', error);

      // Return safe mock data if API fails
      if (process.env.NODE_ENV === 'development') {
        logger.warn('Returning mock safe analysis result due to API error');
        return {
          categories: [
            { name: 'hate', severity: 0 },
            { name: 'self-harm', severity: 0 },
            { name: 'sexual', severity: 0 },
            { name: 'violence', severity: 0 }
          ],
          overallScore: 0
        };
      }

      throw error;
    }
  }
}

// Export singleton instance
module.exports = new AzureAIService();
