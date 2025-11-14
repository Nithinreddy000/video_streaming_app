require('dotenv').config();
const mongoose = require('mongoose');
const Video = require('./src/models/video.model');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const videos = await Video.find({ 
    'processedFiles.hls': { $exists: true } 
  }).limit(3).lean();
  
  console.log('Sample videos with HLS:');
  videos.forEach(v => {
    console.log('\nVideo ID:', v._id.toString());
    console.log('HLS URL:', v.processedFiles?.hls);
    console.log('Status:', v.status);
    console.log('Processing Stage:', v.processingStage);
  });
  
  process.exit(0);
}).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
