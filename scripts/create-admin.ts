/**
 * Create initial admin user for testing
 * Run: bun scripts/create-admin.ts
 */
import { connectDB, disconnectDB, AuthService } from '../common';

async function createAdmin() {
  console.log('Connecting to database...');
  await connectDB();

  const email = 'admin@example.com';
  const name = 'Admin';
  const role = 'admin' as const;

  console.log(`Creating admin user: ${email}`);

  const result = await AuthService.createUserWithPassword(email, name, role);

  if (result) {
    console.log('\n✅ Admin user created successfully!');
    console.log('================================');
    console.log(`Email: ${email}`);
    console.log(`Password: ${result.temporaryPassword}`);
    console.log('================================');
    console.log('\n⚠️  Save this password! It will not be shown again.');
  } else {
    console.log('\n❌ Failed to create admin user (maybe it already exists)');
  }

  await disconnectDB();
  process.exit(0);
}

createAdmin().catch(console.error);
