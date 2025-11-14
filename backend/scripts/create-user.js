/**
 * MongoDB Script: Create New User
 *
 * Interactive script to create users with specified roles (viewer, editor, admin)
 *
 * Usage: node scripts/create-user.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User.model');
const Tenant = require('../src/models/Tenant.model');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function listTenants() {
  const tenants = await Tenant.find({}).select('name slug _id');

  console.log('\n' + '='.repeat(70));
  console.log('AVAILABLE ORGANIZATIONS/TENANTS');
  console.log('='.repeat(70));
  console.log('ID'.padEnd(28) + 'Name'.padEnd(25) + 'Slug');
  console.log('-'.repeat(70));

  tenants.forEach((tenant, index) => {
    console.log(
      `${index + 1}. ${tenant._id.toString().padEnd(24)} ${tenant.name.padEnd(21)} ${tenant.slug}`
    );
  });

  console.log('='.repeat(70));
  return tenants;
}

async function validateEmail(email) {
  const emailRegex = /^\S+@\S+\.\S+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, message: 'Invalid email format' };
  }

  // Check if email already exists
  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    return { valid: false, message: 'Email already exists' };
  }

  return { valid: true };
}

async function validateUsername(username) {
  if (username.length < 3) {
    return { valid: false, message: 'Username must be at least 3 characters' };
  }

  if (username.length > 30) {
    return { valid: false, message: 'Username cannot exceed 30 characters' };
  }

  // Check if username already exists
  const existingUser = await User.findOne({ username });
  if (existingUser) {
    return { valid: false, message: 'Username already exists' };
  }

  return { valid: true };
}

async function validatePassword(password) {
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters' };
  }

  return { valid: true };
}

async function createUser() {
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB\n');

    console.log('='.repeat(70));
    console.log('CREATE NEW USER');
    console.log('='.repeat(70));
    console.log('\nThis script will create a new user with specified role and organization.\n');

    // Step 1: Select tenant/organization
    const tenants = await listTenants();

    if (tenants.length === 0) {
      console.log('\n❌ No tenants/organizations found. Please create a tenant first.');
      rl.close();
      process.exit(1);
    }

    const tenantChoice = await question('\nSelect organization number (1-' + tenants.length + '): ');
    const selectedTenantIndex = parseInt(tenantChoice) - 1;

    if (isNaN(selectedTenantIndex) || selectedTenantIndex < 0 || selectedTenantIndex >= tenants.length) {
      console.log('\n❌ Invalid selection');
      rl.close();
      process.exit(1);
    }

    const selectedTenant = tenants[selectedTenantIndex];
    console.log(`\n✅ Selected: ${selectedTenant.name} (${selectedTenant.slug})`);

    // Step 2: Get user details
    console.log('\n' + '-'.repeat(70));
    console.log('USER DETAILS');
    console.log('-'.repeat(70));

    // Username
    let username, usernameValidation;
    do {
      username = await question('\nUsername (3-30 characters): ');
      usernameValidation = await validateUsername(username.trim());
      if (!usernameValidation.valid) {
        console.log(`❌ ${usernameValidation.message}`);
      }
    } while (!usernameValidation.valid);

    // Email
    let email, emailValidation;
    do {
      email = await question('Email: ');
      emailValidation = await validateEmail(email.trim());
      if (!emailValidation.valid) {
        console.log(`❌ ${emailValidation.message}`);
      }
    } while (!emailValidation.valid);

    // Password
    let password, passwordValidation;
    do {
      password = await question('Password (minimum 8 characters): ');
      passwordValidation = await validatePassword(password);
      if (!passwordValidation.valid) {
        console.log(`❌ ${passwordValidation.message}`);
      }
    } while (!passwordValidation.valid);

    // Role
    console.log('\n📌 Available roles:');
    console.log('   1. viewer  - Read-only access to assigned videos');
    console.log('   2. editor  - Upload, edit, and manage video content');
    console.log('   3. admin   - Full system access and user management');

    const roleChoice = await question('\nSelect role (1-3): ');
    let role;
    switch (roleChoice.trim()) {
      case '1':
        role = 'viewer';
        break;
      case '2':
        role = 'editor';
        break;
      case '3':
        role = 'admin';
        break;
      default:
        console.log('\n❌ Invalid role selection. Defaulting to viewer.');
        role = 'viewer';
    }

    // Optional: First and last name
    const firstName = await question('\nFirst Name (optional): ');
    const lastName = await question('Last Name (optional): ');

    // Step 3: Confirmation
    console.log('\n' + '='.repeat(70));
    console.log('CONFIRM USER CREATION');
    console.log('='.repeat(70));
    console.log(`Username:     ${username}`);
    console.log(`Email:        ${email}`);
    console.log(`Role:         ${role}`);
    console.log(`Organization: ${selectedTenant.name}`);
    if (firstName) console.log(`First Name:   ${firstName}`);
    if (lastName) console.log(`Last Name:    ${lastName}`);
    console.log('='.repeat(70));

    const confirm = await question('\nCreate this user? (yes/no): ');

    if (confirm.toLowerCase() !== 'yes') {
      console.log('\n❌ User creation cancelled');
      rl.close();
      process.exit(0);
    }

    // Step 4: Create user
    console.log('\n📝 Creating user...');

    const newUser = new User({
      username: username.trim(),
      email: email.trim().toLowerCase(),
      password: password, // Will be hashed by pre-save hook
      role: role,
      tenant: selectedTenant._id,
      firstName: firstName.trim() || undefined,
      lastName: lastName.trim() || undefined,
      isActive: true
    });

    await newUser.save();

    console.log('\n✅ User created successfully!');
    console.log('\n' + '='.repeat(70));
    console.log('USER DETAILS');
    console.log('='.repeat(70));
    console.log(`ID:           ${newUser._id}`);
    console.log(`Username:     ${newUser.username}`);
    console.log(`Email:        ${newUser.email}`);
    console.log(`Role:         ${newUser.role}`);
    console.log(`Organization: ${selectedTenant.name}`);
    console.log(`Created:      ${newUser.createdAt}`);
    console.log('='.repeat(70));

    console.log('\n💡 User can now login with:');
    console.log(`   Email:    ${newUser.email}`);
    console.log(`   Password: (the password you entered)`);

  } catch (error) {
    console.error('\n❌ Error creating user:', error);
    process.exit(1);
  } finally {
    rl.close();
    await mongoose.connection.close();
    console.log('\n📤 Database connection closed.');
    process.exit(0);
  }
}

// Run the script
console.log('='.repeat(70));
console.log('USER CREATION SCRIPT');
console.log('='.repeat(70));

createUser();
