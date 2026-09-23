// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '@/db/testDb';
import type { DB } from '@/db/client';
import { users } from '@/db/schema';
import { createFriendPair } from '@/db/friends';
import { createPack, setPackEnabled } from '@/db/packs';
import { listPacksForGame } from './packView';

describe('listPacksForGame (WORD-06)', () => {
  let db: DB;
  beforeEach(async () => {
    db = await createTestDb();
  });

  it('lists built-in packs and the caller custom packs, enabled by default', async () => {
    const { userA, game } = await createFriendPair(db, {
      emailA: 'a@example.com',
      emailB: 'b@example.com',
      displayA: 'A',
      displayB: 'B',
    });
    await createPack(db, {
      name: 'Builtin',
      ownerId: null,
      isBuiltin: true,
      words: [{ text: 'x', difficulty: 'easy' }],
    });
    await createPack(db, {
      name: 'Mine',
      ownerId: userA.id,
      isBuiltin: false,
      words: [{ text: 'y', difficulty: 'easy' }],
    });

    const list = await listPacksForGame(db, game.id, userA.id);
    const byName = Object.fromEntries(list.map((p) => [p.name, p]));
    expect(byName['Builtin'].enabled).toBe(true);
    expect(byName['Mine'].enabled).toBe(true);
    expect(list).toHaveLength(2);
  });

  it('excludes other users custom packs', async () => {
    const { userA, game } = await createFriendPair(db, {
      emailA: 'a@example.com',
      emailB: 'b@example.com',
      displayA: 'A',
      displayB: 'B',
    });
    const [stranger] = await db
      .insert(users)
      .values({ email: 's@example.com', displayName: 'S' })
      .returning();
    await createPack(db, {
      name: 'Theirs',
      ownerId: stranger.id,
      isBuiltin: false,
      words: [{ text: 'z', difficulty: 'easy' }],
    });
    const list = await listPacksForGame(db, game.id, userA.id);
    expect(list.find((p) => p.name === 'Theirs')).toBeUndefined();
  });

  it('reflects a disabled pack as enabled=false, others stay enabled', async () => {
    const { userA, game } = await createFriendPair(db, {
      emailA: 'a@example.com',
      emailB: 'b@example.com',
      displayA: 'A',
      displayB: 'B',
    });
    const off = await createPack(db, {
      name: 'Off',
      ownerId: null,
      isBuiltin: true,
      words: [{ text: 'x', difficulty: 'easy' }],
    });
    await createPack(db, {
      name: 'On',
      ownerId: null,
      isBuiltin: true,
      words: [{ text: 'y', difficulty: 'easy' }],
    });
    await setPackEnabled(db, game.id, off.pack.id, false);

    const list = await listPacksForGame(db, game.id, userA.id);
    const byName = Object.fromEntries(list.map((p) => [p.name, p]));
    expect(byName['Off'].enabled).toBe(false);
    expect(byName['On'].enabled).toBe(true);
  });
});
