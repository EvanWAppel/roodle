// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '@/db/testDb';
import { __setTestDb } from '@/db/client';
import { users } from '@/db/schema';
import { verifySessionToken, SESSION_COOKIE } from '@/auth/session';
import type { DB } from '@/db/client';
import { POST as requestRoute } from './request/route';
import { GET as callbackRoute } from './callback/route';

describe('auth routes (AUTH-02/03 wiring)', () => {
  let db: DB;
  beforeEach(async () => {
    db = await createTestDb();
    __setTestDb(db);
  });

  it('request → callback signs a user in and sets a valid session cookie', async () => {
    const reqRes = await requestRoute(
      new Request('http://test/api/auth/request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'christine@example.com' }),
      }),
    );
    const { devLink } = (await reqRes.json()) as { devLink: string };
    expect(devLink).toContain('/api/auth/callback?token=');

    const cbRes = await callbackRoute(new Request(devLink));
    // Redirects home and sets the session cookie.
    expect(cbRes.status).toBeGreaterThanOrEqual(300);
    expect(cbRes.status).toBeLessThan(400);
    const cookie = cbRes.cookies.get(SESSION_COOKIE);
    expect(cookie?.value).toBeTruthy();

    const uid = verifySessionToken(cookie!.value);
    expect(uid).toBeTruthy();
    const [user] = await db.select().from(users).where(eq(users.id, uid!));
    expect(user.email).toBe('christine@example.com');
  });

  it('rejects a missing email with 400', async () => {
    const res = await requestRoute(
      new Request('http://test/api/auth/request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(400);
  });

  it('honors a post-login return path (invite-accept deferral)', async () => {
    const reqRes = await requestRoute(
      new Request('http://test/api/auth/request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'friend@example.com' }),
      }),
    );
    const { devLink } = (await reqRes.json()) as { devLink: string };

    const returnTo = '/api/invites/accept?token=abc';
    const cbRes = await callbackRoute(
      new Request(devLink, {
        headers: {
          cookie: `roodle_post_login=${encodeURIComponent(returnTo)}`,
        },
      }),
    );
    expect(cbRes.headers.get('location')).toContain('/api/invites/accept');
    // And the deferral cookie is cleared.
    expect(cbRes.cookies.get('roodle_post_login')?.value).toBe('');
  });

  it('ignores a non-relative post-login return path (no open redirect)', async () => {
    const reqRes = await requestRoute(
      new Request('http://test/api/auth/request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'friend2@example.com' }),
      }),
    );
    const { devLink } = (await reqRes.json()) as { devLink: string };
    const cbRes = await callbackRoute(
      new Request(devLink, {
        headers: { cookie: `roodle_post_login=${encodeURIComponent('https://evil.example')}` },
      }),
    );
    expect(cbRes.headers.get('location')).toMatch(/\/$/);
  });

  it('a bad token redirects to sign-in with an error', async () => {
    const res = await callbackRoute(
      new Request('http://test/api/auth/callback?token=bogus'),
    );
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.headers.get('location')).toContain('/signin?error=link');
  });
});
