// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { sql } from 'drizzle-orm';
import { createTestDb } from './testDb';

describe('database (SCAF-06 health check)', () => {
  it('connects and runs a trivial query', async () => {
    const db = await createTestDb();
    const res = await db.execute(sql`select 1 as one`);
    expect(res.rows[0]).toMatchObject({ one: 1 });
  });

  it('has the core tables after migration', async () => {
    const db = await createTestDb();
    const res = await db.execute(
      sql`select table_name from information_schema.tables where table_schema = 'public'`,
    );
    const names = res.rows.map((r) => (r as { table_name: string }).table_name);
    expect(names).toEqual(expect.arrayContaining(['users', 'games', 'turns']));
  });
});
