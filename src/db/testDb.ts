import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { afterEach, inject } from 'vitest';
import * as schema from './schema';
import type { DB } from './client';
import '../test/pgliteTemplate';

let template: Promise<Blob | null> | undefined;

/** Every DB opened in the current test; closed after it so WASM heaps don't pile up. */
const open: PGlite[] = [];
afterEach(async () => {
  const clients = open.splice(0);
  await Promise.all(clients.map((c) => (c.closed ? undefined : c.close())));
});

/** The pre-migrated data dir from globalSetup, read once per test file. */
function loadTemplate(): Promise<Blob | null> {
  template ??= (async () => {
    const path = inject('pgliteTemplatePath');
    if (!path) return null;
    return new Blob([await readFile(path)]);
  })();
  return template;
}

/**
 * Fresh in-memory PGlite with all migrations applied. One per test for isolation.
 *
 * W-01: clones the template data dir migrated once by `src/test/pgliteTemplate.ts`
 * (vitest globalSetup) rather than re-running every migration per test. Falls back
 * to migrating from scratch if no template was provided. Each DB is closed
 * automatically after the test that opened it (create it per test, not in beforeAll).
 */
export async function createTestDb(): Promise<DB> {
  const dataDir = await loadTemplate();
  if (dataDir) {
    const client = await PGlite.create({ loadDataDir: dataDir });
    open.push(client);
    return drizzle(client, { schema });
  }
  const client = new PGlite();
  open.push(client);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: './drizzle' });
  return db;
}
