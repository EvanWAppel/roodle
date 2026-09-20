import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/auth/session';

/** POST /api/auth/logout — clear the session cookie. */
export async function POST(req: Request) {
  const res = NextResponse.redirect(new URL('/', req.url));
  res.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}
