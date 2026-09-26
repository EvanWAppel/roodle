// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '@/db/testDb';
import { __setTestDb } from '@/db/client';
import { users, games, packs } from '@/db/schema';
import type { DB } from '@/db/client';
import type { User } from '@/db/schema';
import { seedBuiltinPacks, BUILTIN_PACKS } from '@/db/packsSeed';
import { setPackEnabled } from '@/db/packs';

const currentUser = vi.fn<() => Promise<User | null>>();
vi.mock('@/auth/currentUser', () => ({
  getCurrentUser: () => currentUser(),
}));

import { GET as wordRoute } from './route';

function get(qs: string): Request {
  return new Request(`http://test/api/packs/word${qs}`);
}

describe('GET /api/packs/word (WORD-03)', () => {
  let db: DB;
  let me: User;
  let gameId: string;
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
    currentUser.mockReset();
    currentUser.mockResolvedValue(me);
  });

  it('offers a word only from the game’s enabled packs', async () => {
    const [animals] = await db
      .select()
      .from(packs)
      .where(eq(packs.name, 'Animals'));
    await setPackEnabled(db, gameId, animals.id, true);
    const animalWords = new Set(
      BUILTIN_PACKS.find((p) => p.name === 'Animals')!.words.map((x) => x.text),
    );

    for (let i = 0; i < 20; i++) {
      const res = await wordRoute(get(`?gameId=${gameId}`));
      expect(res.status).toBe(200);
      const body = (await res.json()) as { word: { text: string } | null };
      expect(animalWords.has(body.word!.text)).toBe(true);
    }
  });

  it('honors difficulty', async () => {
    const all = await db.select().from(packs);
    for (const p of all) await setPackEnabled(db, gameId, p.id, true);
    const res = await wordRoute(get(`?gameId=${gameId}&difficulty=hard`));
    const body = (await res.json()) as {
      word: { difficulty: string } | null;
    };
    expect(body.word!.difficulty).toBe('hard');
  });

  it('returns 401 when unauthenticated', async () => {
    currentUser.mockResolvedValue(null);
    const res = await wordRoute(get(`?gameId=${gameId}`));
    expect(res.status).toBe(401);
  });

  it('returns 403 when the caller is not a game member', async () => {
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
    const res = await wordRoute(get(`?gameId=${other.id}`));
    expect(res.status).toBe(403);
  });

  it('returns 400 when gameId is missing', async () => {
    const res = await wordRoute(get(''));
    expect(res.status).toBe(400);
  });
});
