// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '@/db/testDb';
import { __setTestDb } from '@/db/client';
import { users, games, packs, gamePacks } from '@/db/schema';
import { createCustomPack } from '@/db/packs';
import type { DB } from '@/db/client';
import type { User } from '@/db/schema';
import { seedBuiltinPacks } from '@/db/packsSeed';

const currentUser = vi.fn<() => Promise<User | null>>();
vi.mock('@/auth/currentUser', () => ({
  getCurrentUser: () => currentUser(),
}));

import { POST as enableRoute } from './route';

function post(body: unknown): Request {
  return new Request('http://test/api/packs/enable', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/packs/enable (WORD-05)', () => {
  let db: DB;
  let me: User;
  let gameId: string;
  let packId: string;
  beforeEach(async () => {
    db = await createTestDb();
    __setTestDb(db);
    await seedBuiltinPacks(db);
    const [a] = await db
      .insert(users)
      .values({ email: 'me@x.com', displayName: 'Me' })
      .returning();
    const [b] = await db
      .insert(users)
      .values({ email: 'you@x.com', displayName: 'You' })
      .returning();
    me = a;
    const [game] = await db
      .insert(games)
      .values({ playerA: a.id, playerB: b.id })
      .returning();
    gameId = game.id;
    const [pack] = await db
      .select()
      .from(packs)
      .where(eq(packs.name, 'Animals'));
    packId = pack.id;
    currentUser.mockReset();
    currentUser.mockResolvedValue(me);
  });

  it('enables then disables a pack for the game', async () => {
    let res = await enableRoute(post({ gameId, packId, enabled: true }));
    expect(res.status).toBe(200);
    let rows = await db
      .select()
      .from(gamePacks)
      .where(eq(gamePacks.gameId, gameId));
    expect(rows.map((r) => r.packId)).toContain(packId);

    res = await enableRoute(post({ gameId, packId, enabled: false }));
    expect(res.status).toBe(200);
    rows = await db
      .select()
      .from(gamePacks)
      .where(eq(gamePacks.gameId, gameId));
    expect(rows.map((r) => r.packId)).not.toContain(packId);
  });

  it('returns 401 when unauthenticated', async () => {
    currentUser.mockResolvedValue(null);
    const res = await enableRoute(post({ gameId, packId, enabled: true }));
    expect(res.status).toBe(401);
  });

  it('returns 403 when not a game member', async () => {
    const [x] = await db
      .insert(users)
      .values({ email: 'x@x.com', displayName: 'X' })
      .returning();
    const [y] = await db
      .insert(users)
      .values({ email: 'z@x.com', displayName: 'Z' })
      .returning();
    const [other] = await db
      .insert(games)
      .values({ playerA: x.id, playerB: y.id })
      .returning();
    const res = await enableRoute(
      post({ gameId: other.id, packId, enabled: true }),
    );
    expect(res.status).toBe(403);
  });

  it('returns 400 for an invalid payload', async () => {
    const res = await enableRoute(post({ gameId, packId }));
    expect(res.status).toBe(400);
  });

  it('returns 404 for a pack that does not exist', async () => {
    const res = await enableRoute(
      post({
        gameId,
        packId: '00000000-0000-0000-0000-000000000000',
        enabled: true,
      }),
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 when enabling another user's custom pack (IDOR fix)", async () => {
    // A stranger (not in this game) owns a custom pack.
    const [stranger] = await db
      .insert(users)
      .values({ email: 'stranger@x.com', displayName: 'Stranger' })
      .returning();
    const theirs = await createCustomPack(db, {
      ownerId: stranger.id,
      name: 'Private Pack',
      words: [{ text: 'secret' }],
    });
    // `me` is a member of the game but does NOT own the pack.
    const res = await enableRoute(
      post({ gameId, packId: theirs.id, enabled: true }),
    );
    expect(res.status).toBe(403);
    const rows = await db
      .select()
      .from(gamePacks)
      .where(eq(gamePacks.gameId, gameId));
    expect(rows.map((r) => r.packId)).not.toContain(theirs.id);
  });
});
