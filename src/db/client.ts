import { PGlite } from '@electric-sql/pglite';
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js';
import { migrate as migratePg } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as schema from './schema';
import { seedBuiltinPacks } from './packsSeed';

/**
 * Local-first DB for the running app: file-backed PGlite (in-process Postgres).
 * Prod (Neon) wiring via DATABASE_URL is added at provisioning time — see
 * DECISIONS.md D3. Migrations are applied lazily on first access.
 */
export type DB = PgliteDatabase<typeof schema>;

/**
 * Cache the DB promise on globalThis. In Next dev, Server Components and Route
 * Handlers load modules in separate graphs (the "react-server" vs default
 * conditions), so a plain module-level singleton is duplicated — each copy
 * would open its own file-backed PGlite on the same file and collide during
 * migrate. globalThis is shared across both graphs in one process, so this
 * guarantees a single PGlite instance.
 */
const globalForDb = globalThis as unknown as { __roodleDb?: Promise<DB> };

async function init(): Promise<DB> {
  const url = process.env.DATABASE_URL;
  if (url) {
    // Production: a real Postgres (e.g. Railway/Neon). postgres-js suits the
    // long-running Node server `next start` uses. Migrations run on first boot.
    const sql = postgres(url, { max: 5 });
    const db = drizzlePg(sql, { schema });
    await migratePg(db, { migrationsFolder: './drizzle' });
    // Query API matches PGlite for our usage; bridge the driver-specific types.
    const bridged = db as unknown as DB;
    // WORD-02: ensure the curated built-in packs exist (idempotent per name).
    await seedBuiltinPacks(bridged);
    return bridged;
  }
  // Local-first: file-backed PGlite (in-process Postgres).
  const client = new PGlite(process.env.PGLITE_PATH ?? './.pglite');
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: './drizzle' });
  // WORD-02: ensure the curated built-in packs exist (idempotent per name).
  await seedBuiltinPacks(db);
  return db;
}

export function getDb(): Promise<DB> {
  if (!globalForDb.__roodleDb) globalForDb.__roodleDb = init();
  return globalForDb.__roodleDb;
}

/** Test-only: point getDb() at an injected database (e.g. an in-memory test DB). */
export function __setTestDb(db: DB | null): void {
  globalForDb.__roodleDb = db ? Promise.resolve(db) : undefined;
}
