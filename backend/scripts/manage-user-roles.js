/**
 * MongoDB Script: Manage User Roles
 *
 * This script allows you to assign roles to specific users.
 *
 * Usage: node scripts/manage-user-roles.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User.model');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function manageRoles() {
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB\n');

    while (true) {
      console.log('\n' + '='.repeat(50));
      console.log('USER ROLE MANAGEMENT');
      console.log('='.repeat(50));
      console.log('1. List all users');
      console.log('2. Update user role');
      console.log('3. View role statistics');
      console.log('4. Exit');
      console.log('='.repeat(50));

      const choice = await question('\nEnter your choice (1-4): ');

      switch (choice.trim()) {
        case '1':
          await listUsers();
          break;
        case '2':
          await updateUserRole();
          break;
        case '3':
          await viewStatistics();
          break;
        case '4':
          console.log('\n👋 Goodbye!');
          rl.close();
          await mongoose.connection.close();
          process.exit(0);
        default:
          console.log('\n❌ Invalid choice. Please try again.');
      }
    }
  } catch (error) {
    console.error('\n❌ Error:', error);
    rl.close();
    process.exit(1);
  }
}

async function listUsers() {
  const users = await User.find({}).select('username email role firstName lastName isActive');

  console.log('\n' + '='.repeat(80));
  console.log('ALL USERS');
  console.log('='.repeat(80));
  console.log(
    'ID'.padEnd(26) +
    'Username'.padEnd(18) +
    'Email'.padEnd(30) +
    'Role'.padEnd(10) +
    'Status'
  );
  console.log('-'.repeat(80));

  users.forEach(user => {
    console.log(
      user._id.toString().padEnd(26) +
      (user.username || '').padEnd(18) +
      (user.email || '').padEnd(30) +
      (user.role || 'none').padEnd(10) +
      (user.isActive ? '✅ Active' : '❌ Inactive')
    );
  });

  console.log('='.repeat(80));
  console.log(`Total: ${users.length} users`);
}

async function updateUserRole() {
  const identifier = await question('\nEnter username or email: ');
  const user = await User.findOne({
    $or: [
      { username: identifier },
      { email: identifier.toLowerCase() }
    ]
  });

  if (!user) {
    console.log('\n❌ User not found.');
    return;
  }

  console.log('\n📋 Current user details:');
  console.log(`   Username: ${user.username}`);
  console.log(`   Email: ${user.email}`);
  console.log(`   Current Role: ${user.role}`);
  console.log(`   Status: ${user.isActive ? 'Active' : 'Inactive'}`);

  console.log('\n📌 Available roles:');
  console.log('   1. viewer   - Read-only access to assigned videos');
  console.log('   2. editor   - Upload, edit, and manage video content');
  console.log('   3. admin    - Full system access and user management');

  const roleChoice = await question('\nEnter new role (viewer/editor/admin): ');
  const newRole = roleChoice.trim().toLowerCase();

  if (!['viewer', 'editor', 'admin'].includes(newRole)) {
    console.log('\n❌ Invalid role. Please enter viewer, editor, or admin.');
    return;
  }

  const confirm = await question(`\n⚠️  Change ${user.username}'s role from "${user.role}" to "${newRole}"? (yes/no): `);

  if (confirm.toLowerCase() === 'yes') {
    user.role = newRole;
    await user.save();
    console.log(`\n✅ Successfully updated ${user.username}'s role to "${newRole}"`);
  } else {
    console.log('\n❌ Operation cancelled.');
  }
}

async function viewStatistics() {
  const users = await User.find({});
  const stats = {
    total: users.length,
    active: 0,
    inactive: 0,
    viewer: 0,
    editor: 0,
    admin: 0
  };

  users.forEach(user => {
    if (user.isActive) stats.active++;
    else stats.inactive++;

    if (user.role === 'viewer') stats.viewer++;
    else if (user.role === 'editor') stats.editor++;
    else if (user.role === 'admin') stats.admin++;
  });

  console.log('\n' + '='.repeat(50));
  console.log('USER STATISTICS');
  console.log('='.repeat(50));
  console.log(`Total Users: ${stats.total}`);
  console.log(`  - Active: ${stats.active}`);
  console.log(`  - Inactive: ${stats.inactive}`);
  console.log('\nRole Distribution:');
  console.log(`  - Viewers: ${stats.viewer} (${((stats.viewer/stats.total)*100).toFixed(1)}%)`);
  console.log(`  - Editors: ${stats.editor} (${((stats.editor/stats.total)*100).toFixed(1)}%)`);
  console.log(`  - Admins: ${stats.admin} (${((stats.admin/stats.total)*100).toFixed(1)}%)`);
  console.log('='.repeat(50));
}

// Run the management interface
manageRoles();
