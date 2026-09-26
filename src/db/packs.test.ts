// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from './testDb';
import type { DB } from './client';
import { users, games, packs, words, gamePacks } from './schema';
import {
  createCustomPack,
  setPackEnabled,
  listPacksForGame,
  selectWordForGame,
} from './packs';
import { seedBuiltinPacks, BUILTIN_PACKS } from './packsSeed';

async function makeUser(db: DB, email: string) {
  const [u] = await db
    .insert(users)
    .values({ email, displayName: email })
    .returning();
  return u;
}

async function makeGame(db: DB) {
  const a = await makeUser(db, `a-${Math.random()}@x.com`);
  const b = await makeUser(db, `b-${Math.random()}@x.com`);
  const [game] = await db
    .insert(games)
    .values({ playerA: a.id, playerB: b.id })
    .returning();
  return { game, owner: a };
}

describe('packs data access (WORD-03/04/05)', () => {
  let db: DB;
  beforeEach(async () => {
    db = await createTestDb();
    await seedBuiltinPacks(db);
  });

  it('createCustomPack persists the pack and its words (WORD-04)', async () => {
    const owner = await makeUser(db, 'owner@x.com');
    const pack = await createCustomPack(db, {
      ownerId: owner.id,
      name: 'Inside Jokes',
      words: [
        { text: 'noodle', difficulty: 'easy' },
        { text: 'roodle', difficulty: 'medium' },
      ],
    });
    expect(pack.ownerId).toBe(owner.id);
    expect(pack.isBuiltin).toBe(false);
    const rows = await db.select().from(words).where(eq(words.packId, pack.id));
    expect(rows.map((r) => r.text).sort()).toEqual(['noodle', 'roodle']);
  });

  it('createCustomPack rejects an empty name or empty word list', async () => {
    const owner = await makeUser(db, 'owner@x.com');
    await expect(
      createCustomPack(db, { ownerId: owner.id, name: '  ', words: [{ text: 'x' }] }),
    ).rejects.toThrow();
    await expect(
      createCustomPack(db, { ownerId: owner.id, name: 'Empty', words: [] }),
    ).rejects.toThrow();
  });

  it('selectWordForGame only offers words from enabled packs (WORD-03/05)', async () => {
    const { game } = await makeGame(db);
    const [animals] = await db
      .select()
      .from(packs)
      .where(eq(packs.name, 'Animals'));
    await setPackEnabled(db, game.id, animals.id, true);

    const animalWords = new Set(
      BUILTIN_PACKS.find((p) => p.name === 'Animals')!.words.map((x) => x.text),
    );
    for (let i = 0; i < 40; i++) {
      const word = await selectWordForGame(db, { gameId: game.id });
      expect(word).not.toBeNull();
      expect(animalWords.has(word!.text)).toBe(true);
    }
  });

  it('honors difficulty: only words at the chosen difficulty are offered', async () => {
    const { game } = await makeGame(db);
    const all = await db.select().from(packs);
    for (const p of all) await setPackEnabled(db, game.id, p.id, true);

    for (let i = 0; i < 40; i++) {
      const word = await selectWordForGame(db, {
        gameId: game.id,
        difficulty: 'hard',
      });
      expect(word!.difficulty).toBe('hard');
    }
  });

  it('a disabled pack’s words are never offered (WORD-05)', async () => {
    const { game } = await makeGame(db);
    const [animals] = await db
      .select()
      .from(packs)
      .where(eq(packs.name, 'Animals'));
    const [food] = await db
      .select()
      .from(packs)
      .where(eq(packs.name, 'Food'));
    await setPackEnabled(db, game.id, animals.id, true);
    await setPackEnabled(db, game.id, food.id, true);
    // Now disable Food again.
    await setPackEnabled(db, game.id, food.id, false);

    const foodWords = new Set(
      BUILTIN_PACKS.find((p) => p.name === 'Food')!.words.map((x) => x.text),
    );
    for (let i = 0; i < 40; i++) {
      const word = await selectWordForGame(db, { gameId: game.id });
      expect(foodWords.has(word!.text)).toBe(false);
    }
    // game_packs row for Food is gone after disabling.
    const rows = await db
      .select()
      .from(gamePacks)
      .where(eq(gamePacks.gameId, game.id));
    expect(rows.map((r) => r.packId)).not.toContain(food.id);
  });

  it('falls back to all built-in packs when no packs are enabled for a game', async () => {
    const { game } = await makeGame(db);
    const word = await selectWordForGame(db, { gameId: game.id });
    expect(word).not.toBeNull();
  });

  it('returns null when enabled packs have no word at the chosen difficulty', async () => {
    const { game, owner } = await makeGame(db);
    const pack = await createCustomPack(db, {
      ownerId: owner.id,
      name: 'Only Easy',
      words: [{ text: 'blob', difficulty: 'easy' }],
    });
    await setPackEnabled(db, game.id, pack.id, true);
    const word = await selectWordForGame(db, {
      gameId: game.id,
      difficulty: 'hard',
    });
    expect(word).toBeNull();
  });

  it('listPacksForGame reports enabled flags', async () => {
    const { game, owner } = await makeGame(db);
    const [animals] = await db
      .select()
      .from(packs)
      .where(eq(packs.name, 'Animals'));
    await setPackEnabled(db, game.id, animals.id, true);

    const list = await listPacksForGame(db, game.id, owner.id);
    const animalsRow = list.find((p) => p.id === animals.id)!;
    expect(animalsRow.enabled).toBe(true);
    const others = list.filter((p) => p.id !== animals.id);
    expect(others.every((p) => p.enabled === false)).toBe(true);
  });

  it('listPacksForGame hides other users\' custom packs (IDOR fix)', async () => {
    const { game, owner } = await makeGame(db);
    const stranger = await makeUser(db, 'stranger@x.com');
    // The game owner's own custom pack — should be visible to them.
    const mine = await createCustomPack(db, {
      ownerId: owner.id,
      name: 'My Secret Pack',
      words: [{ text: 'noodle' }],
    });
    // A stranger's custom pack — must NOT leak to the game owner.
    const theirs = await createCustomPack(db, {
      ownerId: stranger.id,
      name: 'Their Secret Pack',
      words: [{ text: 'roodle' }],
    });

    const list = await listPacksForGame(db, game.id, owner.id);
    const ids = list.map((p) => p.id);
    expect(ids).toContain(mine.id);
    expect(ids).not.toContain(theirs.id);
    // Built-ins are still visible to everyone.
    expect(list.some((p) => p.isBuiltin)).toBe(true);
  });
});
