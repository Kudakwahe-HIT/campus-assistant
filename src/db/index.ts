import { drizzle } from 'drizzle-orm/postgres-js';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import postgres from 'postgres';
import * as schema from './schema';
import { env } from '../env';

function create() {
  // DATABASE_POOL_MAX=1 is needed for single-session servers like pglite-socket.
  const client = postgres(env.databaseUrl, { max: Number(process.env.DATABASE_POOL_MAX) || 10 });
  return drizzle(client, { schema });
}

// Cache on globalThis so Next.js hot reload does not open a new pool each time.
const globalForDb = globalThis as unknown as { __db?: ReturnType<typeof create> };

export function getDb() {
  return (globalForDb.__db ??= create());
}

// Driver-agnostic so tests can pass a PGlite-backed instance.
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
