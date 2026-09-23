// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb } from '@/db/testDb';
import { __setTestDb } from '@/db/client';
import { createFriendPair } from '@/db/friends';
import type { DB } from '@/db/client';
import type { User } from '@/db/schema';

const currentUser = vi.fn<() => Promise<User | null>>();
vi.mock('@/auth/currentUser', () => ({
  getCurrentUser: () => currentUser(),
}));

import { GET as sessionRoute } from './route';

describe('GET /api/auth/session (AUTH-06)', () => {
  let db: DB;
  beforeEach(async () => {
    db = await createTestDb();
    __setTestDb(db);
    currentUser.mockReset();
  });

  it('returns { me: null } when signed out', async () => {
    currentUser.mockResolvedValue(null);
    const res = await sessionRoute();
    const body = (await res.json()) as { me: null };
    expect(body.me).toBeNull();
  });

  it('returns me and their friends with game ids', async () => {
    const pair = await createFriendPair(db, {
      emailA: 'me@example.com',
      emailB: 'friend@example.com',
      displayA: 'Me',
      displayB: 'Friend',
    });
    currentUser.mockResolvedValue(pair.userA);

    const res = await sessionRoute();
    const body = (await res.json()) as {
      me: { id: string; displayName: string };
      friends: { opponent: { id: string; displayName: string }; gameId: string }[];
    };
    expect(body.me.id).toBe(pair.userA.id);
    expect(body.friends).toHaveLength(1);
    expect(body.friends[0].opponent.id).toBe(pair.userB.id);
    expect(body.friends[0].gameId).toBe(pair.game.id);
  });

  it('returns an empty friends list for a user with no friends', async () => {
    const pair = await createFriendPair(db, {
      emailA: 'me@example.com',
      emailB: 'friend@example.com',
      displayA: 'Me',
      displayB: 'Friend',
    });
    // A third user with no friendships.
    currentUser.mockResolvedValue({
      ...pair.userA,
      id: '00000000-0000-0000-0000-000000000000',
    });
    const res = await sessionRoute();
    const body = (await res.json()) as { friends: unknown[] };
    expect(body.friends).toHaveLength(0);
  });
});
