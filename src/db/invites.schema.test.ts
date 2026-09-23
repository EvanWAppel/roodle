// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from './testDb';
import type { DB } from './client';
import { users, invites, friendships } from './schema';

async function makeUser(db: DB, email: string, displayName: string) {
  const [u] = await db.insert(users).values({ email, displayName }).returning();
  return u;
}

describe('invite + friendship schema (GROUP-01)', () => {
  let db: DB;
  beforeEach(async () => {
    db = await createTestDb();
  });

  it('round-trips an invite row', async () => {
    const inviter = await makeUser(db, 'a@example.com', 'A');
    const [row] = await db
      .insert(invites)
      .values({
        inviterId: inviter.id,
        inviteeEmail: 'b@example.com',
        tokenHash: 'deadbeef',
        status: 'pending',
        expiresAt: new Date(Date.now() + 60_000),
      })
      .returning();
    expect(row.inviterId).toBe(inviter.id);
    expect(row.inviteeEmail).toBe('b@example.com');
    expect(row.status).toBe('pending');
    expect(row.acceptedByUserId).toBeNull();
  });

  it('round-trips a friendship row', async () => {
    const a = await makeUser(db, 'a@example.com', 'A');
    const b = await makeUser(db, 'b@example.com', 'B');
    const [lo, hi] = a.id < b.id ? [a.id, b.id] : [b.id, a.id];
    const [row] = await db
      .insert(friendships)
      .values({ userAId: lo, userBId: hi })
      .returning();
    expect(row.userAId).toBe(lo);
    expect(row.userBId).toBe(hi);
  });

  it('rejects a duplicate friendship pair (unique constraint)', async () => {
    const a = await makeUser(db, 'a@example.com', 'A');
    const b = await makeUser(db, 'b@example.com', 'B');
    const [lo, hi] = a.id < b.id ? [a.id, b.id] : [b.id, a.id];
    await db.insert(friendships).values({ userAId: lo, userBId: hi });
    await expect(
      db.insert(friendships).values({ userAId: lo, userBId: hi }),
    ).rejects.toThrow();
  });
});
