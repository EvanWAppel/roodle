// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb } from '@/db/testDb';
import { __setTestDb } from '@/db/client';
import { users } from '@/db/schema';
import type { DB } from '@/db/client';
import type { User } from '@/db/schema';
import { createInvite } from '@/auth/invites';
import { areFriends, findGameForPair } from '@/db/friends';

const currentUser = vi.fn<() => Promise<User | null>>();
vi.mock('@/auth/currentUser', () => ({
  getCurrentUser: () => currentUser(),
}));

import { GET as acceptRoute } from './route';

describe('GET /api/invites/accept (GROUP-03)', () => {
  let db: DB;
  let inviter: User;
  let invitee: User;
  beforeEach(async () => {
    db = await createTestDb();
    __setTestDb(db);
    [inviter] = await db
      .insert(users)
      .values({ email: 'inviter@example.com', displayName: 'Inviter' })
      .returning();
    [invitee] = await db
      .insert(users)
      .values({ email: 'friend@example.com', displayName: 'Friend' })
      .returning();
    currentUser.mockReset();
  });

  it('accepts for a signed-in invitee: links the pair and redirects into the app', async () => {
    currentUser.mockResolvedValue(invitee);
    const { token } = await createInvite(db, inviter.id, invitee.email);
    const res = await acceptRoute(
      new Request(`http://test/api/invites/accept?token=${token}`),
    );
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    expect(await areFriends(db, inviter.id, invitee.id)).toBe(true);
    expect(await findGameForPair(db, inviter.id, invitee.id)).toBeTruthy();
  });

  it('redirects an unauthenticated invitee to sign-in (deferring the accept)', async () => {
    currentUser.mockResolvedValue(null);
    const { token } = await createInvite(db, inviter.id, invitee.email);
    const res = await acceptRoute(
      new Request(`http://test/api/invites/accept?token=${token}`),
    );
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    expect(res.headers.get('location')).toContain('/signin');
    // Not yet friends — accept is deferred until sign-in.
    expect(await areFriends(db, inviter.id, invitee.id)).toBe(false);
  });

  it('returns 410 for an expired token', async () => {
    currentUser.mockResolvedValue(invitee);
    const past = Date.now() - 8 * 24 * 60 * 60 * 1000;
    const { token } = await createInvite(db, inviter.id, invitee.email, past);
    const res = await acceptRoute(
      new Request(`http://test/api/invites/accept?token=${token}`),
    );
    expect(res.status).toBe(410);
  });

  it('returns 400 for an unknown token', async () => {
    currentUser.mockResolvedValue(invitee);
    const res = await acceptRoute(
      new Request('http://test/api/invites/accept?token=bogus'),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when the token is missing', async () => {
    currentUser.mockResolvedValue(invitee);
    const res = await acceptRoute(
      new Request('http://test/api/invites/accept'),
    );
    expect(res.status).toBe(400);
  });
});
