// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from './testDb';
import type { DB } from './client';
import { users, friendships, games } from './schema';
import { eq } from 'drizzle-orm';
import {
  ensureFriendship,
  ensureGameForPair,
  createFriendPair,
  listFriendsWithGames,
} from './friends';

async function makeUser(db: DB, email: string, displayName: string) {
  const [u] = await db.insert(users).values({ email, displayName }).returning();
  return u;
}

describe('friends helpers (GROUP-03 / AUTH-06)', () => {
  let db: DB;
  beforeEach(async () => {
    db = await createTestDb();
  });

  it('ensureFriendship stores a pair once in canonical order regardless of arg order', async () => {
    const a = await makeUser(db, 'a@example.com', 'A');
    const b = await makeUser(db, 'b@example.com', 'B');
    const [lo, hi] = a.id < b.id ? [a.id, b.id] : [b.id, a.id];

    const f1 = await ensureFriendship(db, a.id, b.id);
    expect(f1.userAId).toBe(lo);
    expect(f1.userBId).toBe(hi);

    // Re-run with reversed args: same row, no duplicate.
    const f2 = await ensureFriendship(db, b.id, a.id);
    expect(f2.id).toBe(f1.id);

    const all = await db.select().from(friendships);
    expect(all).toHaveLength(1);
  });

  it('ensureGameForPair creates one game and reuses it', async () => {
    const a = await makeUser(db, 'a@example.com', 'A');
    const b = await makeUser(db, 'b@example.com', 'B');
    const g1 = await ensureGameForPair(db, a.id, b.id);
    const g2 = await ensureGameForPair(db, b.id, a.id);
    expect(g2.id).toBe(g1.id);
    expect(await db.select().from(games)).toHaveLength(1);
  });

  it('createFriendPair inserts two users, a friendship, and a game', async () => {
    const { userA, userB, friendship, game } = await createFriendPair(db, {
      emailA: 'Evan@Example.com',
      emailB: 'Christine@Example.com',
      displayA: 'Evan',
      displayB: 'Christine',
    });
    expect(userA.email).toBe('evan@example.com');
    expect(userB.email).toBe('christine@example.com');
    const [lo, hi] =
      userA.id < userB.id ? [userA.id, userB.id] : [userB.id, userA.id];
    expect(friendship.userAId).toBe(lo);
    expect(friendship.userBId).toBe(hi);
    expect([game.playerA, game.playerB].sort()).toEqual([lo, hi].sort());

    const [gameRow] = await db
      .select()
      .from(games)
      .where(eq(games.id, game.id));
    expect(gameRow).toBeTruthy();
  });

  it('listFriendsWithGames returns each friend + shared game for a user', async () => {
    const me = await makeUser(db, 'me@example.com', 'Me');
    const f1 = await makeUser(db, 'f1@example.com', 'F1');
    const f2 = await makeUser(db, 'f2@example.com', 'F2');
    const stranger = await makeUser(db, 's@example.com', 'S');

    await ensureFriendship(db, me.id, f1.id);
    const g1 = await ensureGameForPair(db, me.id, f1.id);
    await ensureFriendship(db, me.id, f2.id);
    const g2 = await ensureGameForPair(db, me.id, f2.id);
    // A friendship not involving me — must not appear.
    await ensureFriendship(db, f1.id, stranger.id);

    const friends = await listFriendsWithGames(db, me.id);
    expect(friends).toHaveLength(2);
    const byOpponent = new Map(friends.map((x) => [x.opponent.id, x.gameId]));
    expect(byOpponent.get(f1.id)).toBe(g1.id);
    expect(byOpponent.get(f2.id)).toBe(g2.id);
    expect(byOpponent.has(stranger.id)).toBe(false);
  });
});
