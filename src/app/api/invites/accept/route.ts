import { NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { getCurrentUser } from '@/auth/currentUser';
import { acceptInvite } from '@/auth/invites';
import { POST_LOGIN_COOKIE, POST_LOGIN_MAX_AGE_S } from '@/auth/session';

/**
 * GET /api/invites/accept?token=… — accept a friend invite (GROUP-03).
 * Requires a session; a signed-out invitee is bounced through sign-in with the
 * accept URL stashed so the callback can bring them back here to finish.
 */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('token');
  if (!token) {
    return NextResponse.json({ error: 'missing token' }, { status: 400 });
  }

  const user = await getCurrentUser();
  if (!user) {
    // Defer the accept: sign in first, then the callback returns here.
    const res = NextResponse.redirect(new URL('/signin', req.url));
    const returnTo = `/api/invites/accept?token=${token}`;
    res.cookies.set(POST_LOGIN_COOKIE, returnTo, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: POST_LOGIN_MAX_AGE_S,
    });
    return res;
  }

  const db = await getDb();
  try {
    await acceptInvite(db, token, user.id);
  } catch (e) {
    // Expected token failures map to client errors; anything else propagates.
    if (e instanceof Error && e.message === 'invite expired') {
      return NextResponse.json({ error: 'invite expired' }, { status: 410 });
    }
    if (e instanceof Error && e.message === 'invalid invite token') {
      return NextResponse.json({ error: 'invalid invite' }, { status: 400 });
    }
    throw e;
  }

  // Friends now — drop them into the game.
  return NextResponse.redirect(new URL('/play', req.url));
}
