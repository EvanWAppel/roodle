import { NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { consumeMagicLink } from '@/auth/service';
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_S,
  createSessionToken,
} from '@/auth/session';

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

  const res = NextResponse.redirect(new URL('/', req.url));
  res.cookies.set(SESSION_COOKIE, createSessionToken(userId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_S,
  });
  return res;
}
