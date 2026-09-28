import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import type { Db } from '../db';
import * as schema from '../db/schema';

const MIGRATIONS = join(__dirname, '..', '..', 'drizzle');

/** Fresh in-memory Postgres with every migration in /drizzle applied, in order. */
export async function createTestDb(): Promise<{ db: Db; client: PGlite }> {
  const client = new PGlite();
  const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS, file), 'utf8');
    for (const statement of sql.split('--> statement-breakpoint')) {
      if (statement.trim()) await client.exec(statement);
    }
  }
  return { db: drizzle(client, { schema }) as unknown as Db, client };
}
