require('dotenv').config();
const mongoose = require('mongoose');
const { User, Tenant } = require('../src/models');

/**
 * Seed script to create admin and editor users
 * Run with: node scripts/seed-users.js
 */

const users = [
  {
    username: 'admin',
    email: 'admin@example.com',
    password: 'Admin@123',
    firstName: 'Admin',
    lastName: 'User',
    role: 'admin',
  },
  {
    username: 'editor',
    email: 'editor@example.com',
    password: 'Editor@123',
    firstName: 'Editor',
    lastName: 'User',
    role: 'editor',
  },
];

async function seedUsers() {
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get or create default tenant (use existing demo tenant if available)
    let tenant = await Tenant.findOne({ slug: 'demo-org' });

    if (!tenant) {
      console.log('Creating default tenant...');
      tenant = await Tenant.create({
        name: 'Demo Organization',
        slug: 'demo-org',
        subscription: {
          plan: 'free',
          status: 'trial',
        },
      });
      console.log('✅ Tenant created:', tenant.name);
    } else {
      console.log('✅ Using existing tenant:', tenant.name);
    }

    // Create users
    console.log('\nCreating users...');

    for (const userData of users) {
      // Check if user already exists
      const existingUser = await User.findOne({ email: userData.email });

      if (existingUser) {
        console.log(`⚠️  User ${userData.email} already exists - updating role to ${userData.role}`);
        existingUser.role = userData.role;
        await existingUser.save();
        console.log(`✅ Updated ${userData.email} role to ${userData.role}`);
      } else {
        const user = await User.create({
          ...userData,
          tenant: tenant._id,
          isActive: true,
        });
        console.log(`✅ Created ${userData.role} user: ${user.email}`);
      }
    }

    console.log('\n✅ Seed completed successfully!');
    console.log('\n📋 Login Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Admin User:');
    console.log('  Email:    admin@example.com');
    console.log('  Password: Admin@123');
    console.log('  Role:     admin');
    console.log('');
    console.log('Editor User:');
    console.log('  Email:    editor@example.com');
    console.log('  Password: Editor@123');
    console.log('  Role:     editor');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding users:', error);
    process.exit(1);
  }
}

// Run the seed
seedUsers();
