import { eq } from 'drizzle-orm';
import type { DB } from '@/db/client';
import { users, authTokens, type User } from '@/db/schema';
import { generateToken, hashToken } from './tokens';

export const TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Issue a magic-link token for an email. Stores only the hash; returns the raw
 * token for the caller to put in the link. Throws on an invalid email.
 */
export async function requestMagicLink(
  db: DB,
  email: string,
  now: number = Date.now(),
): Promise<{ email: string; token: string }> {
  const normalized = normalizeEmail(email);
  if (!EMAIL_RE.test(normalized)) throw new Error('invalid email');
  const raw = generateToken();
  await db.insert(authTokens).values({
    email: normalized,
    tokenHash: hashToken(raw),
    expiresAt: new Date(now + TOKEN_TTL_MS),
  });
  return { email: normalized, token: raw };
}

/**
 * Consume a raw magic-link token: validate (exists, unused, unexpired), mark it
 * used, and upsert the user by email. Throws a clear error on any failure.
 */
export async function consumeMagicLink(
  db: DB,
  rawToken: string,
  now: number = Date.now(),
): Promise<User> {
  const hash = hashToken(rawToken);
  const [row] = await db
    .select()
    .from(authTokens)
    .where(eq(authTokens.tokenHash, hash))
    .limit(1);
  if (!row) throw new Error('invalid token');
  if (row.usedAt) throw new Error('token already used');
  if (row.expiresAt.getTime() < now) throw new Error('token expired');

  await db
    .update(authTokens)
    .set({ usedAt: new Date(now) })
    .where(eq(authTokens.id, row.id));

  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, row.email))
    .limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(users)
    .values({ email: row.email, displayName: row.email.split('@')[0] })
    .returning();
  return created;
}
