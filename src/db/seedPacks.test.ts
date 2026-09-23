// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '@/db/testDb';
import type { DB } from '@/db/client';
import { packs, words } from '@/db/schema';
import {
  seedBuiltinPacks,
  BUILTIN_PACKS,
  BUILTIN_WORD_COUNT,
} from './seedPacks';

describe('seedBuiltinPacks (WORD-02)', () => {
  let db: DB;
  beforeEach(async () => {
    db = await createTestDb();
  });

  it('loads the expected number of built-in packs and words', async () => {
    const { created } = await seedBuiltinPacks(db);
    expect(created).toBe(BUILTIN_PACKS.length);
    expect(BUILTIN_PACKS.length).toBeGreaterThanOrEqual(3); // "a few categories"

    const packRows = await db.select().from(packs);
    expect(packRows).toHaveLength(BUILTIN_PACKS.length);
    for (const p of packRows) {
      expect(p.isBuiltin).toBe(true);
      expect(p.ownerId).toBeNull();
    }

    const wordRows = await db.select().from(words);
    expect(wordRows).toHaveLength(BUILTIN_WORD_COUNT);
  });

  it('includes a mix of difficulties', async () => {
    await seedBuiltinPacks(db);
    const wordRows = await db.select().from(words);
    const difficulties = new Set(wordRows.map((r) => r.difficulty));
    expect(difficulties).toEqual(new Set(['easy', 'medium', 'hard']));
  });

  it('is idempotent: re-seeding creates nothing and does not duplicate', async () => {
    await seedBuiltinPacks(db);
    const second = await seedBuiltinPacks(db);
    expect(second.created).toBe(0);

    const packRows = await db.select().from(packs);
    expect(packRows).toHaveLength(BUILTIN_PACKS.length);
    const wordRows = await db.select().from(words);
    expect(wordRows).toHaveLength(BUILTIN_WORD_COUNT);
  });

  it('every seeded pack has at least one word', async () => {
    await seedBuiltinPacks(db);
    const packRows = await db.select().from(packs);
    for (const p of packRows) {
      const w = await db.select().from(words).where(eq(words.packId, p.id));
      expect(w.length).toBeGreaterThan(0);
    }
  });
});
