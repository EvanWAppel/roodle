// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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

import { POST as inviteRoute, GET as listRoute } from './route';

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

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
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

  it('resends a pending invite with a new link and retires the old one', async () => {
    await inviteRoute(post({ email: 'friend@example.com' }));
    const res = await inviteRoute(
      post({ email: 'friend@example.com', resend: true }),
    );
    expect(res.status).toBe(201);
    expect(capture.sentInvites).toHaveLength(2);
    expect(capture.sentInvites[1].url).not.toBe(capture.sentInvites[0].url);
    const rows = await db.select().from(invites);
    expect(rows.filter((row) => row.status === 'pending')).toHaveLength(1);
    expect(rows.filter((row) => row.status === 'expired')).toHaveLength(1);
  });

  it('rolls back a failed email so the invitation can be retried', async () => {
    vi.spyOn(capture, 'sendInvite').mockRejectedValueOnce(
      new Error('provider failure'),
    );
    const failed = await inviteRoute(post({ email: 'friend@example.com' }));
    expect(failed.status).toBe(502);
    expect(await db.select().from(invites)).toHaveLength(0);
    expect(
      (await inviteRoute(post({ email: 'friend@example.com' }))).status,
    ).toBe(201);
  });

  it('preserves the previous invite when resending fails', async () => {
    await inviteRoute(post({ email: 'friend@example.com' }));
    const original = await db.select().from(invites);
    vi.spyOn(capture, 'sendInvite').mockRejectedValueOnce(
      new Error('provider failure'),
    );
    const failed = await inviteRoute(
      post({ email: 'friend@example.com', resend: true }),
    );
    expect(failed.status).toBe(502);
    expect(await db.select().from(invites)).toEqual(original);
  });

  it('does not claim email delivery in production without a provider', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('RESEND_API_KEY', '');
    vi.stubEnv('EMAIL_FROM', '');
    expect(
      (await inviteRoute(post({ email: 'friend@example.com' }))).status,
    ).toBe(503);
    expect(await db.select().from(invites)).toHaveLength(0);
    expect(capture.sentInvites).toHaveLength(0);
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

describe('GET /api/invites', () => {
  let db: DB;
  let inviter: User;
  beforeEach(async () => {
    db = await createTestDb();
    __setTestDb(db);
    const [u] = await db
      .insert(users)
      .values({ email: 'inviter@example.com', displayName: 'Inviter' })
      .returning();
    inviter = u;
    currentUser.mockReset();
    currentUser.mockResolvedValue(inviter);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the signed-in user’s pending invites without token material', async () => {
    await inviteRoute(post({ email: 'friend@example.com' }));
    const res = await listRoute();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      invites: Array<Record<string, unknown>>;
    };
    expect(body.invites).toHaveLength(1);
    expect(body.invites[0].inviteeEmail).toBe('friend@example.com');
    expect(body.invites[0].label).toMatch(/^Expires in /);
    expect(body.invites[0].expired).toBe(false);
    expect(body.invites[0]).not.toHaveProperty('tokenHash');
  });

  it('does not leak another user’s invites (ownership)', async () => {
    const [other] = await db
      .insert(users)
      .values({ email: 'other@example.com', displayName: 'Other' })
      .returning();
    currentUser.mockResolvedValue(other);
    await inviteRoute(post({ email: 'theirs@example.com' }));

    currentUser.mockResolvedValue(inviter);
    const res = await listRoute();
    const body = (await res.json()) as { invites: unknown[] };
    expect(body.invites).toHaveLength(0);
  });

  it('returns 401 when unauthenticated', async () => {
    currentUser.mockResolvedValue(null);
    expect((await listRoute()).status).toBe(401);
  });
});
