import { NextResponse } from 'next/server';
import { resolveBaseUrl } from '@/lib/baseUrl';
import { SESSION_COOKIE } from '@/auth/session';

/** POST /api/auth/logout — clear the session cookie. */
export async function POST(req: Request) {
  // Redirect to the canonical host (behind a proxy req.url is localhost).
  const res = NextResponse.redirect(new URL('/', resolveBaseUrl(req)));
  res.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}
