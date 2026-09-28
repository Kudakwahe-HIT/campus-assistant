import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { env } from '../env';

function create() {
  const client = postgres(env.databaseUrl, { max: 10 });
  return drizzle(client, { schema });
}

// Cache on globalThis so Next.js hot reload does not open a new pool each time.
const globalForDb = globalThis as unknown as { __db?: ReturnType<typeof create> };

export function getDb() {
  return (globalForDb.__db ??= create());
}

export type Db = ReturnType<typeof getDb>;
