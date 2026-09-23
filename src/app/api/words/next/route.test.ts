// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb } from '@/db/testDb';
import { __setTestDb } from '@/db/client';
import type { DB } from '@/db/client';
import type { User } from '@/db/schema';
import { createFriendPair } from '@/db/friends';
import { createPack, setPackEnabled } from '@/db/packs';
import { WORD_LIST } from '@/lib/words';

const currentUser = vi.fn<() => Promise<User | null>>();
vi.mock('@/auth/currentUser', () => ({
  getCurrentUser: () => currentUser(),
}));

import { GET as nextWord } from './route';

function get(params: Record<string, string>): Request {
  const qs = new URLSearchParams(params).toString();
  return new Request(`http://test/api/words/next?${qs}`);
}

describe('GET /api/words/next (WORD-03)', () => {
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

  it('offers only words from enabled packs at the chosen difficulty', async () => {
    const easy = await createPack(db, {
      name: 'Easy',
      ownerId: null,
      isBuiltin: true,
      words: [{ text: 'onlyeasy', difficulty: 'easy' }],
    });
    const hard = await createPack(db, {
      name: 'Hard',
      ownerId: null,
      isBuiltin: true,
      words: [{ text: 'onlyhard', difficulty: 'hard' }],
    });
    await setPackEnabled(db, gameId, easy.pack.id, true);
    await setPackEnabled(db, gameId, hard.pack.id, true);

    for (let i = 0; i < 10; i++) {
      const res = await nextWord(get({ game: gameId, difficulty: 'easy' }));
      const body = (await res.json()) as { word: string; source: string };
      expect(body.word).toBe('onlyeasy');
      expect(body.source).toBe('pack');
    }
  });

  it('never offers a disabled pack word (WORD-05)', async () => {
    const enabled = await createPack(db, {
      name: 'On',
      ownerId: null,
      isBuiltin: true,
      words: [{ text: 'keeper', difficulty: 'easy' }],
    });
    const disabled = await createPack(db, {
      name: 'Off',
      ownerId: null,
      isBuiltin: true,
      words: [{ text: 'forbidden', difficulty: 'easy' }],
    });
    await setPackEnabled(db, gameId, enabled.pack.id, true);
    await setPackEnabled(db, gameId, disabled.pack.id, false);

    for (let i = 0; i < 15; i++) {
      const res = await nextWord(get({ game: gameId, difficulty: 'easy' }));
      const body = (await res.json()) as { word: string };
      expect(body.word).toBe('keeper');
      expect(body.word).not.toBe('forbidden');
    }
  });

  it('falls back to the built-in list when no enabled-pack word exists', async () => {
    const p = await createPack(db, {
      name: 'Only',
      ownerId: null,
      isBuiltin: true,
      words: [{ text: 'somethingelse', difficulty: 'easy' }],
    });
    await setPackEnabled(db, gameId, p.pack.id, false); // all disabled

    const res = await nextWord(get({ game: gameId, difficulty: 'easy' }));
    const body = (await res.json()) as { word: string; source: string };
    expect(body.source).toBe('builtin');
    expect(WORD_LIST).toContain(body.word);
  });

  it('returns 401 when unauthenticated', async () => {
    currentUser.mockResolvedValue(null);
    const res = await nextWord(get({ game: gameId }));
    expect(res.status).toBe(401);
  });

  it('returns 400 without a game id', async () => {
    const res = await nextWord(get({}));
    expect(res.status).toBe(400);
  });

  it('returns 403 for a game the user is not in', async () => {
    const other = await createFriendPair(db, {
      emailA: 'c@example.com',
      emailB: 'd@example.com',
      displayA: 'C',
      displayB: 'D',
    });
    const res = await nextWord(get({ game: other.game.id }));
    expect(res.status).toBe(403);
  });
});
