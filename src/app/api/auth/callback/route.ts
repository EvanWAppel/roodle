import { NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { consumeMagicLink } from '@/auth/service';
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_S,
  POST_LOGIN_COOKIE,
  createSessionToken,
} from '@/auth/session';

/**
 * Resolve a post-login return target to a URL that is guaranteed same-origin as
 * the request, or null. Two independent guards, because neither alone is enough:
 *  1. Resolve the raw value against a placeholder origin and require it to stay
 *     there — rejects `//evil.com`, `/\evil.com`, and backslash tricks (WHATWG
 *     treats `\` as `/`).
 *  2. Re-resolve the *rebuilt* path against the real request origin and require
 *     the final origin to match — path normalization can collapse inputs like
 *     `/..//evil.com` into a protocol-relative `//evil.com` that (1)'s pathname
 *     would otherwise smuggle through, so we validate the value we actually
 *     redirect to, not just the input.
 */
function safeReturnTo(value: string | undefined, req: Request): URL | null {
  if (!value) return null;
  if (!value.startsWith('/')) return null;
  const PLACEHOLDER = 'http://placeholder.invalid';
  let resolved: URL;
  try {
    resolved = new URL(value, PLACEHOLDER);
  } catch {
    return null;
  }
  if (resolved.origin !== PLACEHOLDER) return null;

  const path = resolved.pathname + resolved.search + resolved.hash;
  const appOrigin = new URL(req.url).origin;
  let dest: URL;
  try {
    dest = new URL(path, req.url);
  } catch {
    return null;
  }
  if (dest.origin !== appOrigin) return null;
  return dest;
}

/** GET /api/auth/callback?token=… — verify the link, start a session (AUTH-03). */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('token');
  if (!token) {
    return NextResponse.json({ error: 'missing token' }, { status: 400 });
  }

  const AUTH_FAILURES = ['invalid token', 'token already used', 'token expired'];
  const db = await getDb();
  let userId: string;
  try {
    const user = await consumeMagicLink(db, token);
    userId = user.id;
  } catch (e) {
    // Expected link failures bounce to sign-in; anything else propagates.
    if (e instanceof Error && AUTH_FAILURES.includes(e.message)) {
      return NextResponse.redirect(new URL('/signin?error=link', req.url));
    }
    throw e;
  }

  // Return the user to a deferred destination (e.g. an invite-accept URL they
  // hit while signed out), else home. Only same-origin paths are honored.
  const rawReturn = req.headers
    .get('cookie')
    ?.match(new RegExp(`${POST_LOGIN_COOKIE}=([^;]+)`))?.[1];
  const returnTo = safeReturnTo(
    rawReturn ? decodeURIComponent(rawReturn) : undefined,
    req,
  );

  const res = NextResponse.redirect(returnTo ?? new URL('/', req.url));
  res.cookies.set(SESSION_COOKIE, createSessionToken(userId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_S,
  });
  if (returnTo) {
    res.cookies.set(POST_LOGIN_COOKIE, '', { path: '/', maxAge: 0 });
  }
  return res;
}
