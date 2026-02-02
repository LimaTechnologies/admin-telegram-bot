/**
 * Delete admin user
 * Run: bun scripts/delete-admin.ts
 */
import { connectDB, disconnectDB } from '../common';
import { User } from '../common/models/user.model';

async function deleteAdmin() {
  console.log('Connecting to database...');
  await connectDB();

  const result = await User.deleteOne({ email: 'admin@example.com' });
  console.log('Deleted:', result.deletedCount, 'user(s)');

  await disconnectDB();
  process.exit(0);
}

deleteAdmin().catch(console.error);
