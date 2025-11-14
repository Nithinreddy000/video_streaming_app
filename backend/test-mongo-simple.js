#!/usr/bin/env node

require('dotenv').config();

const mongoose = require('mongoose');

async function test() {
  try {
    console.log('🔄 Testing MongoDB connection...');
    console.log('URI:', process.env.MONGODB_URI ? process.env.MONGODB_URI.substring(0, 50) + '...' : 'NOT SET');
    
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI not set in .env');
    }

    const options = {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 15000,
    };

    console.log('⏳ Attempting connection...');
    const start = Date.now();

    await mongoose.connect(process.env.MONGODB_URI, options);
    
    const elapsed = Date.now() - start;
    console.log(`✅ Connected in ${elapsed}ms`);
    
    // Test a simple operation
    console.log('🔍 Testing database...');
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`📊 Found ${collections.length} collections`);
    
    await mongoose.connection.close();
    console.log('✅ Connection closed');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Name:', error.name);
    console.error('Code:', error.code);
    if (error.reason) console.error('Reason:', error.reason);
    process.exit(1);
  }
}

test();
