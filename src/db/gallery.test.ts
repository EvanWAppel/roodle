// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from './testDb';
import type { DB } from './client';
import { createFriendPair, isGameMember } from './friends';
import { createTurn, submitGuess, giveUp } from './turns';
import type { Drawing } from '@/lib/strokes';
import { getGameGallery } from './gallery';
import { users } from './schema';

const strokes: Drawing = [
  { color: '#111827', width: 4, points: [{ x: 1, y: 2 }] },
];

describe('gallery (DESIGN-10)', () => {
  let db: DB;
  let a: string;
  let b: string;
  let gameId: string;

  beforeEach(async () => {
    db = await createTestDb();
    const pair = await createFriendPair(db, {
      emailA: 'evan@example.com',
      emailB: 'christine@example.com',
      displayA: 'Evan',
      displayB: 'Christine',
    });
    a = pair.userA.id;
    b = pair.userB.id;
    gameId = pair.game.id;
  });

  describe('getGameGallery', () => {
    it('returns resolved drawings newest-first with strokes and both names', async () => {
      const first = await createTurn(db, {
        gameId,
        drawerId: a,
        guesserId: b,
        word: 'cat',
        strokes,
      });
      await submitGuess(db, first.id, 'cat');
      const second = await createTurn(db, {
        gameId,
        drawerId: b,
        guesserId: a,
        word: 'dog',
        strokes,
      });
      await giveUp(db, second.id);

      const gallery = await getGameGallery(db, gameId);
      expect(gallery).toHaveLength(2);
      // Newest first: the give-up on 'dog' resolved after the 'cat' guess.
      expect(gallery[0].word).toBe('dog');
      expect(gallery[0].status).toBe('gave_up');
      expect(gallery[0].drawerName).toBe('Christine');
      expect(gallery[0].guesserName).toBe('Evan');
      expect(gallery[0].drawing).toEqual(strokes);
      expect(gallery[1].word).toBe('cat');
      expect(gallery[1].status).toBe('guessed');
      expect(gallery[1].pointsAwarded).toBeGreaterThan(0);
    });

    it('never includes an unresolved (awaiting_guess) turn — no answer leak', async () => {
      await createTurn(db, {
        gameId,
        drawerId: a,
        guesserId: b,
        word: 'secret',
        strokes,
      });
      const gallery = await getGameGallery(db, gameId);
      expect(gallery).toHaveLength(0);
    });
  });

  describe('isGameMember', () => {
    it('is true for both players in the game', async () => {
      expect(await isGameMember(db, a, gameId)).toBe(true);
      expect(await isGameMember(db, b, gameId)).toBe(true);
    });

    it('is false for a user not in the game', async () => {
      const [stranger] = await db
        .insert(users)
        .values({ email: 'mallory@example.com', displayName: 'Mallory' })
        .returning();
      expect(await isGameMember(db, stranger.id, gameId)).toBe(false);
    });

    it('is false for an unknown game', async () => {
      expect(
        await isGameMember(db, a, '00000000-0000-0000-0000-000000000000'),
      ).toBe(false);
    });
  });
});
