/**
 * MongoDB Migration Script: Add Viewer Role
 *
 * This script ensures all users have a valid role.
 * Users without a role will be assigned 'viewer' by default.
 *
 * Usage: node scripts/add-viewer-role.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User.model');

async function migrateRoles() {
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    // Find users without a role or with invalid roles
    console.log('\n📊 Checking user roles...');
    const users = await User.find({});
    console.log(`Total users found: ${users.length}`);

    let updateCount = 0;
    let stats = {
      viewer: 0,
      editor: 0,
      admin: 0,
      updated: 0
    };

    // Process each user
    for (const user of users) {
      const validRoles = ['viewer', 'editor', 'admin'];

      if (!user.role || !validRoles.includes(user.role)) {
        console.log(`\n⚠️  User "${user.username}" (${user.email}) has invalid role: ${user.role || 'none'}`);
        user.role = 'viewer';
        await user.save();
        updateCount++;
        stats.updated++;
        console.log(`✅ Updated to: viewer`);
      }

      // Count role distribution
      if (user.role === 'viewer') stats.viewer++;
      else if (user.role === 'editor') stats.editor++;
      else if (user.role === 'admin') stats.admin++;
    }

    // Print summary
    console.log('\n' + '='.repeat(50));
    console.log('MIGRATION SUMMARY');
    console.log('='.repeat(50));
    console.log(`Total users: ${users.length}`);
    console.log(`Users updated: ${stats.updated}`);
    console.log('\nRole Distribution:');
    console.log(`  - Viewers: ${stats.viewer}`);
    console.log(`  - Editors: ${stats.editor}`);
    console.log(`  - Admins: ${stats.admin}`);
    console.log('='.repeat(50));

    if (updateCount === 0) {
      console.log('\n✅ All users already have valid roles. No updates needed.');
    } else {
      console.log(`\n✅ Migration completed! ${updateCount} user(s) updated.`);
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    // Close connection
    await mongoose.connection.close();
    console.log('\n📤 Database connection closed.');
    process.exit(0);
  }
}

// Interactive prompt to confirm migration
console.log('='.repeat(50));
console.log('USER ROLE MIGRATION SCRIPT');
console.log('='.repeat(50));
console.log('\nThis script will:');
console.log('1. Check all users in the database');
console.log('2. Assign "viewer" role to users without a valid role');
console.log('3. Display statistics about role distribution\n');

// Run migration
migrateRoles();
