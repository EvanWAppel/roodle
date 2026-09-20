// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '@/db/testDb';
import type { DB } from '@/db/client';
import { users } from '@/db/schema';
import { CaptureTransport } from './email';
import { requestMagicLink, consumeMagicLink, TOKEN_TTL_MS } from './service';

describe('auth service (AUTH-02/03)', () => {
  let db: DB;
  beforeEach(async () => {
    db = await createTestDb();
  });

  it('issues a token and a transport can deliver a link', async () => {
    const { email, token } = await requestMagicLink(db, '  Evan@Example.com ');
    expect(email).toBe('evan@example.com');
    const mail = new CaptureTransport();
    await mail.sendMagicLink({ to: email, url: `https://x/cb?token=${token}` });
    expect(mail.sent[0].url).toContain(token);
  });

  it('rejects an invalid email', async () => {
    await expect(requestMagicLink(db, 'not-an-email')).rejects.toThrow(/invalid/);
  });

  it('consuming a valid token creates the user and marks the token used', async () => {
    const { token } = await requestMagicLink(db, 'christine@example.com');
    const user = await consumeMagicLink(db, token);
    expect(user.email).toBe('christine@example.com');
    expect(user.displayName).toBe('christine');
    // reuse is rejected (single-use)
    await expect(consumeMagicLink(db, token)).rejects.toThrow(/already used/);
  });

  it('reuses an existing user for the same email', async () => {
    const [seeded] = await db
      .insert(users)
      .values({ email: 'evan@example.com', displayName: 'Evan' })
      .returning();
    const { token } = await requestMagicLink(db, 'evan@example.com');
    const user = await consumeMagicLink(db, token);
    expect(user.id).toBe(seeded.id);
    expect(user.displayName).toBe('Evan'); // not overwritten
  });

  it('rejects an unknown token', async () => {
    await expect(consumeMagicLink(db, 'bogus')).rejects.toThrow(/invalid token/);
  });

  it('rejects an expired token', async () => {
    const past = Date.now() - TOKEN_TTL_MS - 1000;
    const { token } = await requestMagicLink(db, 'late@example.com', past);
    await expect(consumeMagicLink(db, token)).rejects.toThrow(/expired/);
    // and no user was created
    const found = await db
      .select()
      .from(users)
      .where(eq(users.email, 'late@example.com'));
    expect(found).toHaveLength(0);
  });
});
