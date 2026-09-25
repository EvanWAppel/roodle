// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '@/db/testDb';
import type { DB } from '@/db/client';
import { users, packs, words } from '@/db/schema';
import { createFriendPair } from '@/db/friends';
import {
  createPack,
  wordsInPack,
  candidateWordsForGame,
  disabledPackIdsForGame,
  setPackEnabled,
  pickWordForGame,
  EmptyPackError,
} from './packs';

async function makeUser(db: DB, email: string, name: string) {
  const [u] = await db.insert(users).values({ email, displayName: name }).returning();
  return u;
}

describe('packs data layer (WORD-01/03/05)', () => {
  let db: DB;
  beforeEach(async () => {
    db = await createTestDb();
  });

  describe('WORD-01: models round-trip', () => {
    it('persists a built-in pack (no owner) and its words', async () => {
      const { pack, words: w } = await createPack(db, {
        name: 'Animals',
        ownerId: null,
        isBuiltin: true,
        words: [
          { text: 'cat', difficulty: 'easy' },
          { text: 'platypus', difficulty: 'hard' },
        ],
      });
      expect(pack.id).toBeTruthy();
      expect(pack.ownerId).toBeNull();
      expect(pack.isBuiltin).toBe(true);
      expect(w).toHaveLength(2);

      const [row] = await db.select().from(packs).where(eq(packs.id, pack.id));
      expect(row.name).toBe('Animals');

      const stored = await wordsInPack(db, pack.id);
      expect(stored.map((s) => s.text).sort()).toEqual(['cat', 'platypus']);
      const hard = stored.find((s) => s.text === 'platypus');
      expect(hard?.difficulty).toBe('hard');
    });

    it('persists a custom pack owned by a user', async () => {
      const owner = await makeUser(db, 'owner@example.com', 'Owner');
      const { pack } = await createPack(db, {
        name: 'My Pack',
        ownerId: owner.id,
        isBuiltin: false,
        words: [{ text: 'kite', difficulty: 'medium' }],
      });
      const [row] = await db.select().from(packs).where(eq(packs.id, pack.id));
      expect(row.ownerId).toBe(owner.id);
      expect(row.isBuiltin).toBe(false);
    });

    it('trims blank words and rejects an all-empty pack', async () => {
      await expect(
        createPack(db, {
          name: 'Empty',
          ownerId: null,
          isBuiltin: true,
          words: [{ text: '  ', difficulty: 'easy' }],
        }),
      ).rejects.toBeInstanceOf(EmptyPackError);
    });

    it('requires a name', async () => {
      await expect(
        createPack(db, {
          name: '   ',
          ownerId: null,
          isBuiltin: true,
          words: [{ text: 'cat', difficulty: 'easy' }],
        }),
      ).rejects.toThrow(/name/);
    });
  });

  describe('WORD-03: selection honors packs + difficulty', () => {
    async function seedTwoPacks(gameId: string) {
      const a = await createPack(db, {
        name: 'A',
        ownerId: null,
        isBuiltin: true,
        words: [
          { text: 'ant', difficulty: 'easy' },
          { text: 'aardvark', difficulty: 'hard' },
        ],
      });
      const b = await createPack(db, {
        name: 'B',
        ownerId: null,
        isBuiltin: true,
        words: [
          { text: 'bee', difficulty: 'easy' },
          { text: 'buffalo', difficulty: 'hard' },
        ],
      });
      return { a: a.pack, b: b.pack, gameId };
    }

    it('with no game_packs rows, all packs at the difficulty are offered', async () => {
      const { userA, userB, game } = await createFriendPair(db, {
        emailA: 'a@example.com',
        emailB: 'b@example.com',
        displayA: 'A',
        displayB: 'B',
      });
      void userA;
      void userB;
      await seedTwoPacks(game.id);

      expect((await disabledPackIdsForGame(db, game.id)).size).toBe(0);
      const easy = await candidateWordsForGame(db, game.id, 'easy');
      expect(easy).toEqual(['ant', 'bee']);
      const hard = await candidateWordsForGame(db, game.id, 'hard');
      expect(hard).toEqual(['aardvark', 'buffalo']);
    });

    it('offers only words from enabled packs at the chosen difficulty', async () => {
      const { game } = await createFriendPair(db, {
        emailA: 'a@example.com',
        emailB: 'b@example.com',
        displayA: 'A',
        displayB: 'B',
      });
      const { a, b } = await seedTwoPacks(game.id);
      // Disable only pack B, leaving A enabled by default.
      void a;
      await setPackEnabled(db, game.id, b.id, false);

      expect([...(await disabledPackIdsForGame(db, game.id))]).toEqual([b.id]);
      expect(await candidateWordsForGame(db, game.id, 'easy')).toEqual(['ant']);
      expect(await candidateWordsForGame(db, game.id, 'hard')).toEqual([
        'aardvark',
      ]);
    });

    it('disabling one pack leaves the others enabled by default', async () => {
      const { game } = await createFriendPair(db, {
        emailA: 'a@example.com',
        emailB: 'b@example.com',
        displayA: 'A',
        displayB: 'B',
      });
      const { b } = await seedTwoPacks(game.id);
      // The only explicit action is disabling B; A must remain offered.
      await setPackEnabled(db, game.id, b.id, false);
      expect(await candidateWordsForGame(db, game.id, 'easy')).toEqual(['ant']);
    });
  });

  describe('visibility: a stranger’s private custom pack never leaks into a game', () => {
    it('excludes a non-participant’s custom pack from candidates and picks', async () => {
      const { game } = await createFriendPair(db, {
        emailA: 'a@example.com',
        emailB: 'b@example.com',
        displayA: 'A',
        displayB: 'B',
      });
      // A built-in pack the game can see.
      await createPack(db, {
        name: 'Builtin',
        ownerId: null,
        isBuiltin: true,
        words: [{ text: 'visible', difficulty: 'easy' }],
      });
      // A stranger (not in this game) with a PRIVATE custom pack.
      const stranger = await makeUser(db, 'stranger@example.com', 'Stranger');
      await createPack(db, {
        name: 'Strangers Secret',
        ownerId: stranger.id,
        isBuiltin: false,
        words: [{ text: 'secret', difficulty: 'easy' }],
      });

      const candidates = await candidateWordsForGame(db, game.id, 'easy');
      expect(candidates).toEqual(['visible']);
      expect(candidates).not.toContain('secret');
      for (let i = 0; i < 30; i++) {
        expect(await pickWordForGame(db, game.id, 'easy')).toBe('visible');
      }
    });

    it('includes a participant’s OWN custom pack', async () => {
      const { userA, game } = await createFriendPair(db, {
        emailA: 'a@example.com',
        emailB: 'b@example.com',
        displayA: 'A',
        displayB: 'B',
      });
      await createPack(db, {
        name: 'A’s pack',
        ownerId: userA.id,
        isBuiltin: false,
        words: [{ text: 'mine', difficulty: 'easy' }],
      });
      expect(await candidateWordsForGame(db, game.id, 'easy')).toContain('mine');
    });
  });

  describe('WORD-05: disabled packs are never offered', () => {
    it('a disabled pack contributes no candidate words and is never picked', async () => {
      const { game } = await createFriendPair(db, {
        emailA: 'a@example.com',
        emailB: 'b@example.com',
        displayA: 'A',
        displayB: 'B',
      });
      const enabled = await createPack(db, {
        name: 'Enabled',
        ownerId: null,
        isBuiltin: true,
        words: [{ text: 'keeper', difficulty: 'easy' }],
      });
      const disabled = await createPack(db, {
        name: 'Disabled',
        ownerId: null,
        isBuiltin: true,
        words: [{ text: 'forbidden', difficulty: 'easy' }],
      });
      await setPackEnabled(db, game.id, enabled.pack.id, true);
      await setPackEnabled(db, game.id, disabled.pack.id, false);

      const candidates = await candidateWordsForGame(db, game.id, 'easy');
      expect(candidates).toEqual(['keeper']);

      for (let i = 0; i < 30; i++) {
        const picked = await pickWordForGame(db, game.id, 'easy');
        expect(picked).toBe('keeper');
        expect(picked).not.toBe('forbidden');
      }
    });

    it('toggling a pack back on re-includes its words (upsert, no dup rows)', async () => {
      const { game } = await createFriendPair(db, {
        emailA: 'a@example.com',
        emailB: 'b@example.com',
        displayA: 'A',
        displayB: 'B',
      });
      const p = await createPack(db, {
        name: 'Toggle',
        ownerId: null,
        isBuiltin: true,
        words: [{ text: 'toggled', difficulty: 'medium' }],
      });
      await setPackEnabled(db, game.id, p.pack.id, false);
      expect(await candidateWordsForGame(db, game.id, 'medium')).toEqual([]);
      await setPackEnabled(db, game.id, p.pack.id, true);
      expect(await candidateWordsForGame(db, game.id, 'medium')).toEqual([
        'toggled',
      ]);
    });

    it('when all packs are disabled, nothing is offered and pickWordForGame is null', async () => {
      const { game } = await createFriendPair(db, {
        emailA: 'a@example.com',
        emailB: 'b@example.com',
        displayA: 'A',
        displayB: 'B',
      });
      const p = await createPack(db, {
        name: 'Only',
        ownerId: null,
        isBuiltin: true,
        words: [{ text: 'lonely', difficulty: 'easy' }],
      });
      await setPackEnabled(db, game.id, p.pack.id, false);
      expect(await candidateWordsForGame(db, game.id, 'easy')).toEqual([]);
      expect(await pickWordForGame(db, game.id, 'easy')).toBeNull();
    });
  });

  describe('pickWordForGame', () => {
    it('never returns the excluded word when others are available', async () => {
      const { game } = await createFriendPair(db, {
        emailA: 'a@example.com',
        emailB: 'b@example.com',
        displayA: 'A',
        displayB: 'B',
      });
      await createPack(db, {
        name: 'Pool',
        ownerId: null,
        isBuiltin: true,
        words: [
          { text: 'one', difficulty: 'easy' },
          { text: 'two', difficulty: 'easy' },
          { text: 'three', difficulty: 'easy' },
        ],
      });
      for (let i = 0; i < 50; i++) {
        expect(await pickWordForGame(db, game.id, 'easy', { exclude: 'one' })).not.toBe(
          'one',
        );
      }
    });
  });

  it('words table stores difficulty enum values round-trip', async () => {
    const { pack } = await createPack(db, {
      name: 'Diff',
      ownerId: null,
      isBuiltin: true,
      words: [
        { text: 'e', difficulty: 'easy' },
        { text: 'm', difficulty: 'medium' },
        { text: 'h', difficulty: 'hard' },
      ],
    });
    const rows = await db.select().from(words).where(eq(words.packId, pack.id));
    const byText = Object.fromEntries(rows.map((r) => [r.text, r.difficulty]));
    expect(byText).toEqual({ e: 'easy', m: 'medium', h: 'hard' });
  });
});
