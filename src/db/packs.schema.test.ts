// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from './testDb';
import type { DB } from './client';
import { users, packs, words, gamePacks, games } from './schema';

/** WORD-01: packs/words/game_packs tables round-trip through PGlite migrations. */
describe('packs/words schema (WORD-01)', () => {
  let db: DB;
  beforeEach(async () => {
    db = await createTestDb();
  });

  it('stores a built-in pack (no owner) with difficulty-tagged words', async () => {
    const [pack] = await db
      .insert(packs)
      .values({ name: 'Animals', isBuiltin: true })
      .returning();
    expect(pack.ownerId).toBeNull();
    expect(pack.isBuiltin).toBe(true);

    await db.insert(words).values([
      { packId: pack.id, text: 'cat', difficulty: 'easy' },
      { packId: pack.id, text: 'platypus', difficulty: 'hard' },
    ]);

    const rows = await db.select().from(words).where(eq(words.packId, pack.id));
    expect(rows).toHaveLength(2);
    const byText = Object.fromEntries(rows.map((w) => [w.text, w.difficulty]));
    expect(byText).toEqual({ cat: 'easy', platypus: 'hard' });
  });

  it('word difficulty defaults to easy', async () => {
    const [pack] = await db
      .insert(packs)
      .values({ name: 'Misc', isBuiltin: true })
      .returning();
    const [w] = await db
      .insert(words)
      .values({ packId: pack.id, text: 'thing' })
      .returning();
    expect(w.difficulty).toBe('easy');
  });

  it('stores a custom pack owned by a user', async () => {
    const [owner] = await db
      .insert(users)
      .values({ email: 'o@example.com', displayName: 'Owner' })
      .returning();
    const [pack] = await db
      .insert(packs)
      .values({ name: 'Inside Jokes', ownerId: owner.id, isBuiltin: false })
      .returning();
    expect(pack.ownerId).toBe(owner.id);
    expect(pack.isBuiltin).toBe(false);
  });

  it('enables a pack for a game via game_packs, unique per pair', async () => {
    const [a] = await db
      .insert(users)
      .values({ email: 'a@example.com', displayName: 'A' })
      .returning();
    const [b] = await db
      .insert(users)
      .values({ email: 'b@example.com', displayName: 'B' })
      .returning();
    const [game] = await db
      .insert(games)
      .values({ playerA: a.id, playerB: b.id })
      .returning();
    const [pack] = await db
      .insert(packs)
      .values({ name: 'Animals', isBuiltin: true })
      .returning();

    const [gp] = await db
      .insert(gamePacks)
      .values({ gameId: game.id, packId: pack.id })
      .returning();
    expect(gp.gameId).toBe(game.id);
    expect(gp.packId).toBe(pack.id);

    await expect(
      db.insert(gamePacks).values({ gameId: game.id, packId: pack.id }),
    ).rejects.toThrow();
  });
});
