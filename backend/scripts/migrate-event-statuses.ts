import 'dotenv/config';
import { connectDB, migrateEventStatuses, readEvents } from '../src/db.js';

async function main() {
  await connectDB();
  if (!process.env.MONGODB_URI && !process.env.MONGO_URI) {
    console.error('No MONGODB_URI / MONGO_URI set — cannot connect.');
    process.exit(1);
  }
  const migrated = await migrateEventStatuses();
  console.log(`Migrated ${migrated} event(s).`);
  const events = await readEvents({});
  console.log(
    'Current events:',
    events.map((e) => ({ title: e.title, status: e.status })),
  );
  process.exit(0);
}

main().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});