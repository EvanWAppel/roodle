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
 * Only same-origin relative paths are honored, to prevent open redirects.
 * Resolving against a placeholder origin catches tricks that string checks miss:
 * `//evil.com`, `/\evil.com`, and backslash variants all normalize to a
 * different origin (WHATWG treats `\` as `/`), so any value that doesn't stay on
 * the placeholder origin is rejected.
 */
function safeReturnTo(value: string | undefined): string | null {
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
  return resolved.pathname + resolved.search + resolved.hash;
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
  );

  const res = NextResponse.redirect(new URL(returnTo ?? '/', req.url));
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
