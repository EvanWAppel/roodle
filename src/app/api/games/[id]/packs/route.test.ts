// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb } from '@/db/testDb';
import { __setTestDb } from '@/db/client';
import type { DB } from '@/db/client';
import type { User } from '@/db/schema';
import { createFriendPair } from '@/db/friends';
import { createPack, candidateWordsForGame } from '@/db/packs';

const currentUser = vi.fn<() => Promise<User | null>>();
vi.mock('@/auth/currentUser', () => ({
  getCurrentUser: () => currentUser(),
}));

import { GET as listRoute, PATCH as patchRoute } from './route';

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}
function patch(id: string, body: unknown): Request {
  return new Request(`http://test/api/games/${id}/packs`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('/api/games/[id]/packs (WORD-05/06)', () => {
  let db: DB;
  let userA: User;
  let gameId: string;
  beforeEach(async () => {
    db = await createTestDb();
    __setTestDb(db);
    const pair = await createFriendPair(db, {
      emailA: 'a@example.com',
      emailB: 'b@example.com',
      displayA: 'A',
      displayB: 'B',
    });
    userA = pair.userA;
    gameId = pair.game.id;
    currentUser.mockReset();
    currentUser.mockResolvedValue(userA);
  });

  it('GET lists packs with enabled flags', async () => {
    await createPack(db, {
      name: 'Builtin',
      ownerId: null,
      isBuiltin: true,
      words: [{ text: 'x', difficulty: 'easy' }],
    });
    const res = await listRoute(new Request('http://test'), ctx(gameId));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { packs: { name: string; enabled: boolean }[] };
    expect(body.packs.find((p) => p.name === 'Builtin')?.enabled).toBe(true);
  });

  it('PATCH disables a pack so its words are no longer offered', async () => {
    const p = await createPack(db, {
      name: 'ToDisable',
      ownerId: null,
      isBuiltin: true,
      words: [{ text: 'gone', difficulty: 'easy' }],
    });
    const res = await patchRoute(
      patch(gameId, { packId: p.pack.id, enabled: false }),
      ctx(gameId),
    );
    expect(res.status).toBe(200);
    expect(await candidateWordsForGame(db, gameId, 'easy')).toEqual([]);
  });

  it('GET returns 401 when unauthenticated', async () => {
    currentUser.mockResolvedValue(null);
    const res = await listRoute(new Request('http://test'), ctx(gameId));
    expect(res.status).toBe(401);
  });

  it('GET returns 403 for a game the user is not in', async () => {
    const other = await createFriendPair(db, {
      emailA: 'c@example.com',
      emailB: 'd@example.com',
      displayA: 'C',
      displayB: 'D',
    });
    const res = await listRoute(new Request('http://test'), ctx(other.game.id));
    expect(res.status).toBe(403);
  });

  it('PATCH returns 400 for a bad body', async () => {
    const res = await patchRoute(patch(gameId, { packId: 123 }), ctx(gameId));
    expect(res.status).toBe(400);
  });
});
