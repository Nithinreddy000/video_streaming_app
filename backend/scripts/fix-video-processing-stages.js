const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Import Video model
const Video = require('../src/models/video.model');

async function fixVideoProcessingStages() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find videos with status 'ready' but processingStage not 'completed'
    const videosToFix = await Video.find({
      status: 'ready',
      processingStage: { $ne: 'completed' }
    });

    console.log(`\n📊 Found ${videosToFix.length} videos to fix\n`);

    if (videosToFix.length === 0) {
      console.log('✅ No videos need fixing. All videos are in correct state.');
      await mongoose.connection.close();
      process.exit(0);
    }

    for (const video of videosToFix) {
      console.log(`🔧 Fixing video: ${video._id}`);
      console.log(`   Title: ${video.title}`);
      console.log(`   Current processingStage: ${video.processingStage} → completed`);
      console.log(`   Current processingProgress: ${video.processingProgress}% → 100%`);

      // Update processingStage and processingProgress
      video.processingStage = 'completed';
      video.processingProgress = 100;

      // Update classification if still pending
      if (video.classification === 'pending') {
        console.log(`   Classification: pending → safe`);
        video.classification = 'safe';
      }

      // Populate processedFiles if missing or incomplete
      if (!video.processedFiles || !video.processedFiles.hls) {
        console.log(`   Adding processedFiles with cdnUrl`);
        video.processedFiles = {
          hls: video.cdnUrl, // Use cdnUrl as HLS fallback
          mp4: video.processedFiles?.mp4 || new Map(),
          thumbnail: video.thumbnailUrl || null,
          poster: video.thumbnailUrl || null,
          qualities: video.processedFiles?.qualities || []
        };
      }

      await video.save();
      console.log(`   ✅ Fixed video ${video._id}\n`);
    }

    console.log(`\n✅ Successfully fixed ${videosToFix.length} videos`);
    console.log('🔍 Verifying fixes...');

    // Verify the fixes
    const stillBroken = await Video.find({
      status: 'ready',
      processingStage: { $ne: 'completed' }
    });

    if (stillBroken.length === 0) {
      console.log('✅ Verification passed: All videos are now in correct state');
    } else {
      console.log(`⚠️  Warning: ${stillBroken.length} videos still need fixing`);
    }

    await mongoose.connection.close();
    console.log('👋 Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing videos:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Run the migration
fixVideoProcessingStages();
