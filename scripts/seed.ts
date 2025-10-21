import { seedDefaultUser } from '../lib/auth/service';
import * as dotenv from 'dotenv';

dotenv.config();

async function seed() {
  console.log('Seeding database...');
  await seedDefaultUser();
  console.log('Database seeded successfully!');
  process.exit(0);
}

seed().catch((error) => {
  console.error('Error seeding database:', error);
  process.exit(1);
});
