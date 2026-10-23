import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import type { TestProject } from 'vitest/node';
import * as schema from '../db/schema';

declare module 'vitest' {
  export interface ProvidedContext {
    /** Tarball of a PGlite data dir with every migration applied (W-01). */
    pgliteTemplatePath: string;
  }
}

/**
 * Vitest globalSetup (W-01): boot PGlite and run the migrations ONCE per test
 * run, dump the data dir to a tarball, and hand its path to every worker.
 * `createTestDb()` then loads that tarball per test instead of migrating.
 */
export default async function setup(project: TestProject) {
  const client = new PGlite();
  await migrate(drizzle(client, { schema }), { migrationsFolder: './drizzle' });
  const dump = await client.dumpDataDir('none');
  await client.close();

  const dir = await mkdtemp(join(tmpdir(), 'roodle-pglite-'));
  const path = join(dir, 'template.tar');
  await writeFile(path, Buffer.from(await dump.arrayBuffer()));
  project.provide('pgliteTemplatePath', path);

  return async () => {
    await rm(dir, { recursive: true, force: true });
  };
}
