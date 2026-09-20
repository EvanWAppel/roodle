import { createHmac, timingSafeEqual } from 'node:crypto';

const DEV_SECRET = 'roodle-dev-insecure-secret';

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_SECRET must be set in production');
  }
  return DEV_SECRET;
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

export const SESSION_COOKIE = 'roodle_session';
export const SESSION_MAX_AGE_S = 60 * 60 * 24 * 30; // 30 days

/** Create a tamper-evident session token binding a user id (HMAC-signed). */
export function createSessionToken(userId: string, iat: number = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ uid: userId, iat })).toString(
    'base64url',
  );
  return `${payload}.${sign(payload)}`;
}

/** Return the user id if the token is authentic and unexpired, else null. */
export function verifySessionToken(token: string | undefined | null): string | null {
  if (!token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const { uid, iat } = JSON.parse(
      Buffer.from(payload, 'base64url').toString(),
    ) as { uid: unknown; iat: unknown };
    if (typeof uid !== 'string' || typeof iat !== 'number') return null;
    if (Date.now() - iat > SESSION_MAX_AGE_S * 1000) return null;
    return uid;
  } catch {
    return null;
  }
}
