/**
 * Migration Script: Update all video URLs from BunnyCDN to Fastly CDN
 *
 * This script updates all existing video documents in MongoDB to use
 * the new Fastly CDN URLs instead of the old BunnyCDN URLs.
 *
 * Usage: node scripts/migrate-to-fastly-cdn.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Video = require('../src/models/video.model');

const OLD_CDN_HOSTNAME = 'videosentinelcdn.b-cdn.net';
const NEW_CDN_HOSTNAME = 'videosentinel.global.ssl.fastly.net';

/**
 * Replace CDN hostname in a URL
 */
function replaceCdnUrl(url) {
  if (!url || typeof url !== 'string') return url;
  return url.replace(OLD_CDN_HOSTNAME, NEW_CDN_HOSTNAME);
}

/**
 * Main migration function
 */
async function migrateTofastlyCDN() {
  try {
    console.log('🚀 Starting migration to Fastly CDN...\n');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB\n');

    // Find all videos with BunnyCDN URLs
    const videosWithBunnyCDN = await Video.find({
      $or: [
        { cdnUrl: { $regex: OLD_CDN_HOSTNAME } },
        { 'processedFiles.hls': { $regex: OLD_CDN_HOSTNAME } },
        { thumbnailUrl: { $regex: OLD_CDN_HOSTNAME } }
      ]
    });

    console.log(`📊 Found ${videosWithBunnyCDN.length} videos with BunnyCDN URLs\n`);

    if (videosWithBunnyCDN.length === 0) {
      console.log('✅ No videos to migrate. All videos already using correct CDN.');
      await mongoose.connection.close();
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    // Update each video
    for (const video of videosWithBunnyCDN) {
      try {
        console.log(`📝 Processing video: ${video._id} (${video.title})`);

        const updates = {};
        let hasChanges = false;

        // Update cdnUrl
        if (video.cdnUrl && video.cdnUrl.includes(OLD_CDN_HOSTNAME)) {
          updates.cdnUrl = replaceCdnUrl(video.cdnUrl);
          hasChanges = true;
          console.log(`   - Updated cdnUrl: ${updates.cdnUrl}`);
        }

        // Update thumbnailUrl
        if (video.thumbnailUrl && video.thumbnailUrl.includes(OLD_CDN_HOSTNAME)) {
          updates.thumbnailUrl = replaceCdnUrl(video.thumbnailUrl);
          hasChanges = true;
          console.log(`   - Updated thumbnailUrl`);
        }

        // Update processedFiles if it exists
        if (video.processedFiles) {
          const processedFiles = { ...video.processedFiles };
          let processedFilesChanged = false;

          // Update HLS URL
          if (processedFiles.hls && processedFiles.hls.includes(OLD_CDN_HOSTNAME)) {
            processedFiles.hls = replaceCdnUrl(processedFiles.hls);
            processedFilesChanged = true;
            console.log(`   - Updated HLS URL: ${processedFiles.hls}`);
          }

          // Update DASH URL
          if (processedFiles.dash && processedFiles.dash.includes(OLD_CDN_HOSTNAME)) {
            processedFiles.dash = replaceCdnUrl(processedFiles.dash);
            processedFilesChanged = true;
            console.log(`   - Updated DASH URL`);
          }

          // Update thumbnail URL in processedFiles
          if (processedFiles.thumbnail && processedFiles.thumbnail.includes(OLD_CDN_HOSTNAME)) {
            processedFiles.thumbnail = replaceCdnUrl(processedFiles.thumbnail);
            processedFilesChanged = true;
            console.log(`   - Updated thumbnail in processedFiles`);
          }

          // Update poster URL
          if (processedFiles.poster && processedFiles.poster.includes(OLD_CDN_HOSTNAME)) {
            processedFiles.poster = replaceCdnUrl(processedFiles.poster);
            processedFilesChanged = true;
            console.log(`   - Updated poster URL`);
          }

          // Update MP4 URLs (Map object)
          if (processedFiles.mp4 && processedFiles.mp4 instanceof Map) {
            const newMp4Map = new Map();
            let mp4Changed = false;

            for (const [quality, url] of processedFiles.mp4) {
              if (url && url.includes(OLD_CDN_HOSTNAME)) {
                newMp4Map.set(quality, replaceCdnUrl(url));
                mp4Changed = true;
              } else {
                newMp4Map.set(quality, url);
              }
            }

            if (mp4Changed) {
              processedFiles.mp4 = newMp4Map;
              processedFilesChanged = true;
              console.log(`   - Updated MP4 URLs (${newMp4Map.size} qualities)`);
            }
          }

          if (processedFilesChanged) {
            updates.processedFiles = processedFiles;
            hasChanges = true;
          }
        }

        // Save the updated video
        if (hasChanges) {
          await Video.updateOne(
            { _id: video._id },
            { $set: updates }
          );
          successCount++;
          console.log(`   ✅ Updated successfully\n`);
        } else {
          console.log(`   ⚠️  No changes needed\n`);
        }

      } catch (error) {
        errorCount++;
        console.error(`   ❌ Error updating video ${video._id}:`, error.message, '\n');
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary:');
    console.log('='.repeat(60));
    console.log(`✅ Successfully updated: ${successCount} videos`);
    console.log(`❌ Failed: ${errorCount} videos`);
    console.log(`📁 Total processed: ${videosWithBunnyCDN.length} videos`);
    console.log('='.repeat(60));
    console.log('\n✅ Migration completed!\n');

    // Verify the migration
    console.log('🔍 Verifying migration...');
    const remainingBunnyCDN = await Video.countDocuments({
      $or: [
        { cdnUrl: { $regex: OLD_CDN_HOSTNAME } },
        { 'processedFiles.hls': { $regex: OLD_CDN_HOSTNAME } }
      ]
    });

    if (remainingBunnyCDN === 0) {
      console.log('✅ Verification passed: All videos now using Fastly CDN\n');
    } else {
      console.log(`⚠️  Warning: ${remainingBunnyCDN} videos still have BunnyCDN URLs\n`);
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('👋 Disconnected from MongoDB');
  }
}

// Run the migration
migrateTofastlyCDN();
