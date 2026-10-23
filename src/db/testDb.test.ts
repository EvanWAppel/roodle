// @vitest-environment node
import { describe, it, expect, vi, inject } from 'vitest';
import { sql } from 'drizzle-orm';

// Spy on the migrator: with a pre-migrated template, per-test DBs must not
// re-run migrations (W-01 — that was the cost that timed out hooks under load).
const migrateSpy = vi.hoisted(() => vi.fn());
vi.mock('drizzle-orm/pglite/migrator', async (orig) => {
  const actual = await orig<typeof import('drizzle-orm/pglite/migrator')>();
  return {
    ...actual,
    migrate: (...args: Parameters<typeof actual.migrate>) => {
      migrateSpy(...args);
      return actual.migrate(...args);
    },
  };
});

import { createTestDb } from './testDb';

describe('createTestDb (W-01 template harness)', () => {
  it('global setup provides a migrated template data dir', () => {
    expect(inject('pgliteTemplatePath')).toEqual(expect.any(String));
  });

  it('clones the migrated template instead of re-running migrations', async () => {
    const db = await createTestDb();
    const res = await db.execute(
      sql`select table_name from information_schema.tables where table_schema = 'public'`,
    );
    const names = res.rows.map((r) => (r as { table_name: string }).table_name);
    expect(names).toEqual(expect.arrayContaining(['users', 'games', 'turns']));
    expect(migrateSpy).not.toHaveBeenCalled();
  });

  it('gives each test an isolated database', async () => {
    const a = await createTestDb();
    const b = await createTestDb();
    await a.execute(sql`create table scratch (id int)`);
    await a.execute(sql`insert into scratch values (1)`);
    const inB = await b.execute(
      sql`select count(*)::int as n from information_schema.tables where table_name = 'scratch'`,
    );
    expect(inB.rows[0]).toMatchObject({ n: 0 });
  });

  // Unclosed PGlite instances pile up WASM heaps across a file (worker OOM under load).
  let previous: { closed: boolean } | undefined;
  it('opens a database in one test…', async () => {
    const db = await createTestDb();
    previous = (db as unknown as { $client: { closed: boolean } }).$client;
    expect(previous.closed).toBe(false);
  });
  it('…and it is closed once that test has finished', () => {
    expect(previous?.closed).toBe(true);
  });
});
