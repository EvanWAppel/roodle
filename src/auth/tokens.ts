import { randomBytes, createHash } from 'node:crypto';

/** A high-entropy, URL-safe magic-link token (the raw value emailed to the user). */
export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Only the hash is stored server-side, so a DB leak can't be used to sign in. */
export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}
