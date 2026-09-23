// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '@/db/testDb';
import { __setTestDb } from '@/db/client';
import { users, invites } from '@/db/schema';
import type { DB } from '@/db/client';
import type { User } from '@/db/schema';
import { CaptureTransport } from '@/auth/email';

// Controllable session + email transport for the route under test.
const currentUser = vi.fn<() => Promise<User | null>>();
vi.mock('@/auth/currentUser', () => ({
  getCurrentUser: () => currentUser(),
}));

const capture = new CaptureTransport();
vi.mock('@/auth/email', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/auth/email')>();
  return { ...actual, defaultTransport: () => capture };
});

import { POST as inviteRoute } from './route';

function post(body: unknown): Request {
  return new Request('http://test/api/invites', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/invites (GROUP-02)', () => {
  let db: DB;
  let inviter: User;
  beforeEach(async () => {
    db = await createTestDb();
    __setTestDb(db);
    capture.sentInvites.length = 0;
    const [u] = await db
      .insert(users)
      .values({ email: 'inviter@example.com', displayName: 'Inviter' })
      .returning();
    inviter = u;
    currentUser.mockReset();
    currentUser.mockResolvedValue(inviter);
  });

  it('creates a pending invite and emails the invitee with an accept link', async () => {
    const res = await inviteRoute(post({ email: 'Friend@Example.com' }));
    expect(res.status).toBe(201);

    const [row] = await db
      .select()
      .from(invites)
      .where(eq(invites.inviterId, inviter.id));
    expect(row.inviteeEmail).toBe('friend@example.com');
    expect(row.status).toBe('pending');

    // Emailed the (lowercased) recipient an accept link carrying the token.
    expect(capture.sentInvites).toHaveLength(1);
    expect(capture.sentInvites[0].to).toBe('friend@example.com');
    expect(capture.sentInvites[0].url).toContain('/api/invites/accept?token=');
  });

  it('returns a devLink outside production', async () => {
    const res = await inviteRoute(post({ email: 'friend@example.com' }));
    const body = (await res.json()) as { devLink?: string };
    expect(body.devLink).toContain('/api/invites/accept?token=');
  });

  it('rejects a duplicate pending invite with 409', async () => {
    await inviteRoute(post({ email: 'friend@example.com' }));
    const res = await inviteRoute(post({ email: 'friend@example.com' }));
    expect(res.status).toBe(409);
  });

  it('returns 401 when unauthenticated', async () => {
    currentUser.mockResolvedValue(null);
    const res = await inviteRoute(post({ email: 'friend@example.com' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 for a missing email', async () => {
    const res = await inviteRoute(post({}));
    expect(res.status).toBe(400);
  });
});
