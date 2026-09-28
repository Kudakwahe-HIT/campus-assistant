import 'dotenv/config';
import { getDb } from './index';
import { seedDatabase } from './seed-data';

seedDatabase(getDb())
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
