// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '@/db/testDb';
import { __setTestDb } from '@/db/client';
import { users, packs, words } from '@/db/schema';
import type { DB } from '@/db/client';
import type { User } from '@/db/schema';
import {
  MAX_PACK_WORDS,
  MAX_WORD_LENGTH,
  MAX_PACK_NAME_LENGTH,
} from '@/db/packs';

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

  it('creates a custom pack owned by the session user with its words', async () => {
    const res = await packsRoute(
      post({
        name: 'Inside Jokes',
        words: [
          { text: 'noodle', difficulty: 'easy' },
          { text: 'roodle', difficulty: 'medium' },
        ],
      }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string };

    const [pack] = await db.select().from(packs).where(eq(packs.id, body.id));
    expect(pack.name).toBe('Inside Jokes');
    expect(pack.ownerId).toBe(owner.id);
    expect(pack.isBuiltin).toBe(false);

    const wordRows = await db
      .select()
      .from(words)
      .where(eq(words.packId, pack.id));
    expect(wordRows.map((w) => w.text).sort()).toEqual(['noodle', 'roodle']);
  });

  it('accepts a plain string word list (defaults difficulty to easy)', async () => {
    const res = await packsRoute(
      post({ name: 'Simple', words: ['aaa', 'bbb'] }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string };
    const wordRows = await db
      .select()
      .from(words)
      .where(eq(words.packId, body.id));
    expect(wordRows).toHaveLength(2);
    expect(wordRows.every((w) => w.difficulty === 'easy')).toBe(true);
  });

  it('returns 401 when unauthenticated', async () => {
    currentUser.mockResolvedValue(null);
    const res = await packsRoute(post({ name: 'X', words: ['a'] }));
    expect(res.status).toBe(401);
  });

  it('returns 400 for a missing name', async () => {
    const res = await packsRoute(post({ words: ['a'] }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for an empty word list', async () => {
    const res = await packsRoute(post({ name: 'Empty', words: [] }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when the word list exceeds the cap (storage-abuse guard)', async () => {
    const many = Array.from({ length: MAX_PACK_WORDS + 1 }, (_, i) => `w${i}`);
    const res = await packsRoute(post({ name: 'Too Many', words: many }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for an over-long word or pack name', async () => {
    const longWord = 'x'.repeat(MAX_WORD_LENGTH + 1);
    let res = await packsRoute(post({ name: 'Long Word', words: [longWord] }));
    expect(res.status).toBe(400);

    const longName = 'n'.repeat(MAX_PACK_NAME_LENGTH + 1);
    res = await packsRoute(post({ name: longName, words: ['ok'] }));
    expect(res.status).toBe(400);
  });
});
