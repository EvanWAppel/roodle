// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from './testDb';
import type { DB } from './client';
import { packs, words } from './schema';
import { BUILTIN_PACKS, seedBuiltinPacks } from './packsSeed';

/** WORD-02: curated built-in packs seed with expected counts, idempotently. */
describe('seedBuiltinPacks (WORD-02)', () => {
  let db: DB;
  beforeEach(async () => {
    db = await createTestDb();
  });

  it('seeds every built-in pack and all its words', async () => {
    await seedBuiltinPacks(db);

    const packRows = await db.select().from(packs);
    expect(packRows).toHaveLength(BUILTIN_PACKS.length);
    for (const p of packRows) {
      expect(p.isBuiltin).toBe(true);
      expect(p.ownerId).toBeNull();
    }

    const wordRows = await db.select().from(words);
    const expectedWordCount = BUILTIN_PACKS.reduce(
      (n, p) => n + p.words.length,
      0,
    );
    expect(wordRows).toHaveLength(expectedWordCount);
  });

  it('preserves each word’s difficulty tag from the seed data', async () => {
    await seedBuiltinPacks(db);
    for (const spec of BUILTIN_PACKS) {
      const [pack] = await db
        .select()
        .from(packs)
        .where(eq(packs.name, spec.name));
      const wordRows = await db
        .select()
        .from(words)
        .where(eq(words.packId, pack.id));
      const byText = Object.fromEntries(
        wordRows.map((w) => [w.text, w.difficulty]),
      );
      for (const w of spec.words) {
        expect(byText[w.text]).toBe(w.difficulty);
      }
    }
  });

  it('is idempotent: a second run does not duplicate packs or words', async () => {
    await seedBuiltinPacks(db);
    await seedBuiltinPacks(db);
    const packRows = await db.select().from(packs);
    expect(packRows).toHaveLength(BUILTIN_PACKS.length);
    const wordRows = await db.select().from(words);
    const expectedWordCount = BUILTIN_PACKS.reduce(
      (n, p) => n + p.words.length,
      0,
    );
    expect(wordRows).toHaveLength(expectedWordCount);
  });
});
