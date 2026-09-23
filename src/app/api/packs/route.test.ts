// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '@/db/testDb';
import { __setTestDb } from '@/db/client';
import { users, packs, words } from '@/db/schema';
import type { DB } from '@/db/client';
import type { User } from '@/db/schema';

// Controllable session for the route under test (mirrors invites route test).
const currentUser = vi.fn<() => Promise<User | null>>();
vi.mock('@/auth/currentUser', () => ({
  getCurrentUser: () => currentUser(),
}));

import { POST as packsRoute } from './route';

function post(body: unknown): Request {
  return new Request('http://test/api/packs', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/packs (WORD-04)', () => {
  let db: DB;
  let owner: User;
  beforeEach(async () => {
    db = await createTestDb();
    __setTestDb(db);
    const [u] = await db
      .insert(users)
      .values({ email: 'owner@example.com', displayName: 'Owner' })
      .returning();
    owner = u;
    currentUser.mockReset();
    currentUser.mockResolvedValue(owner);
  });

  it('persists a custom pack owned by the current user with its words', async () => {
    const res = await packsRoute(
      post({
        name: 'My Custom',
        words: [
          { text: 'nebula', difficulty: 'hard' },
          { text: 'moon', difficulty: 'easy' },
        ],
      }),
    );
    expect(res.status).toBe(201);
    const bodyJson = (await res.json()) as { packId: string };

    const [row] = await db
      .select()
      .from(packs)
      .where(eq(packs.id, bodyJson.packId));
    expect(row.name).toBe('My Custom');
    expect(row.ownerId).toBe(owner.id);
    expect(row.isBuiltin).toBe(false);

    const w = await db.select().from(words).where(eq(words.packId, row.id));
    expect(w.map((x) => x.text).sort()).toEqual(['moon', 'nebula']);
  });

  it('defaults omitted difficulty to medium', async () => {
    const res = await packsRoute(post({ name: 'Defaults', words: [{ text: 'x' }] }));
    expect(res.status).toBe(201);
    const bodyJson = (await res.json()) as { packId: string };
    const [w] = await db
      .select()
      .from(words)
      .where(eq(words.packId, bodyJson.packId));
    expect(w.difficulty).toBe('medium');
  });

  it('returns 401 when unauthenticated', async () => {
    currentUser.mockResolvedValue(null);
    const res = await packsRoute(post({ name: 'Nope', words: [{ text: 'x' }] }));
    expect(res.status).toBe(401);
  });

  it('returns 400 for a missing name', async () => {
    const res = await packsRoute(post({ words: [{ text: 'x' }] }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for an empty word list', async () => {
    const res = await packsRoute(post({ name: 'Empty', words: [] }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for a pack of only-blank words', async () => {
    const res = await packsRoute(
      post({ name: 'Blank', words: [{ text: '   ' }] }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 for an invalid difficulty', async () => {
    const res = await packsRoute(
      post({ name: 'Bad', words: [{ text: 'x', difficulty: 'trivial' }] }),
    );
    expect(res.status).toBe(400);
  });
});
