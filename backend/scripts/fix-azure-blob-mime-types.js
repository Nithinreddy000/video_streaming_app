/**
 * Migration Script: Fix Azure Blob Storage MIME Types
 *
 * This script updates Content-Type headers for existing blobs in Azure Blob Storage.
 * Fixes the issue where all files are served with 'application/octet-stream'
 * instead of proper MIME types like 'application/x-mpegURL' for .m3u8 files.
 *
 * Usage: node scripts/fix-azure-blob-mime-types.js
 */

require('dotenv').config();
const { BlobServiceClient } = require('@azure/storage-blob');
const path = require('path');

// Initialize Azure Blob Storage
function initializeAzure() {
  if (!process.env.AZURE_STORAGE_CONNECTION_STRING) {
    throw new Error('AZURE_STORAGE_CONNECTION_STRING not configured in .env');
  }

  const blobServiceClient = BlobServiceClient.fromConnectionString(
    process.env.AZURE_STORAGE_CONNECTION_STRING
  );

  const containerClient = blobServiceClient.getContainerClient(
    process.env.AZURE_STORAGE_CONTAINER_NAME || 'videosentinel-uploads'
  );

  return containerClient;
}

/**
 * Get Content-Type based on file extension
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

/**
 * Fix MIME types for all blobs in Azure Storage
 */
async function fixBlobMimeTypes() {
  try {
    console.log('🚀 Starting Azure Blob Storage MIME type fix...\n');

    const containerClient = initializeAzure();

    console.log(`📦 Container: ${containerClient.containerName}`);
    console.log(`🔗 URL: ${containerClient.url}\n`);

    let totalBlobs = 0;
    let fixedBlobs = 0;
    let skippedBlobs = 0;
    let errorBlobs = 0;

    const blobsToFix = [];

    console.log('🔍 Scanning blobs...\n');

    // List all blobs
    for await (const blob of containerClient.listBlobsFlat()) {
      totalBlobs++;
      const extension = path.extname(blob.name).toLowerCase();
      const currentContentType = blob.properties.contentType;
      const correctContentType = getContentType(blob.name);

      // Check if MIME type needs fixing
      if (currentContentType !== correctContentType) {
        blobsToFix.push({
          name: blob.name,
          extension,
          currentContentType,
          correctContentType,
          size: blob.properties.contentLength
        });
      } else {
        skippedBlobs++;
      }

      // Log progress every 100 blobs
      if (totalBlobs % 100 === 0) {
        console.log(`📊 Scanned ${totalBlobs} blobs...`);
      }
    }

    console.log(`\n✅ Scan complete: ${totalBlobs} total blobs`);
    console.log(`📝 Blobs needing fix: ${blobsToFix.length}`);
    console.log(`✓ Already correct: ${skippedBlobs}\n`);

    if (blobsToFix.length === 0) {
      console.log('🎉 All blobs already have correct MIME types!');
      return;
    }

    // Group by extension for reporting
    const byExtension = {};
    blobsToFix.forEach(blob => {
      if (!byExtension[blob.extension]) {
        byExtension[blob.extension] = [];
      }
      byExtension[blob.extension].push(blob);
    });

    console.log('📋 Blobs to fix by extension:');
    Object.entries(byExtension).forEach(([ext, blobs]) => {
      console.log(`   ${ext}: ${blobs.length} files → ${blobs[0].correctContentType}`);
    });

    console.log('\n🔧 Fixing MIME types...\n');

    // Fix each blob
    for (const blob of blobsToFix) {
      try {
        const blockBlobClient = containerClient.getBlockBlobClient(blob.name);

        // Set new Content-Type
        await blockBlobClient.setHTTPHeaders({
          blobContentType: blob.correctContentType
        });

        fixedBlobs++;
        console.log(`✅ Fixed: ${blob.name}`);
        console.log(`   ${blob.currentContentType} → ${blob.correctContentType}`);

        // Log progress
        if (fixedBlobs % 10 === 0) {
          console.log(`\n📊 Progress: ${fixedBlobs}/${blobsToFix.length} fixed\n`);
        }

      } catch (error) {
        errorBlobs++;
        console.error(`❌ Error fixing ${blob.name}:`, error.message);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary:');
    console.log('='.repeat(60));
    console.log(`✅ Successfully fixed: ${fixedBlobs} blobs`);
    console.log(`✓ Already correct: ${skippedBlobs} blobs`);
    console.log(`❌ Failed: ${errorBlobs} blobs`);
    console.log(`📁 Total processed: ${totalBlobs} blobs`);
    console.log('='.repeat(60));

    if (fixedBlobs > 0) {
      console.log('\n🎉 MIME types fixed successfully!');
      console.log('\n💡 Next steps:');
      console.log('   1. Refresh your browser (Ctrl + Shift + R)');
      console.log('   2. Try playing a video');
      console.log('   3. Video should now play correctly with HLS streaming\n');
    }

    // Show critical files that were fixed
    const criticalExtensions = ['.m3u8', '.ts', '.mp4'];
    const criticalFixed = blobsToFix.filter(b => criticalExtensions.includes(b.extension));

    if (criticalFixed.length > 0) {
      console.log('\n🎯 Critical video files fixed:');
      criticalExtensions.forEach(ext => {
        const count = criticalFixed.filter(b => b.extension === ext).length;
        if (count > 0) {
          console.log(`   ${ext}: ${count} files`);
        }
      });
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
fixBlobMimeTypes()
  .then(() => {
    console.log('\n👋 Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });
