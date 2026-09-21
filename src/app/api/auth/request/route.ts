import { NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { requestMagicLink } from '@/auth/service';
import { defaultTransport } from '@/auth/email';
import { RateLimiter } from '@/auth/rateLimit';

const WINDOW_MS = 15 * 60 * 1000;
const perEmail = new RateLimiter(4, WINDOW_MS);
const perIp = new RateLimiter(30, WINDOW_MS);

/** POST /api/auth/request { email } — issue + "send" a magic link (AUTH-02). */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { email?: string } | null;
  if (!body || typeof body.email !== 'string') {
    return NextResponse.json({ error: 'missing email' }, { status: 400 });
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!perEmail.check(body.email.trim().toLowerCase()) || !perIp.check(ip)) {
    return NextResponse.json(
      { error: 'too many requests, try again later' },
      { status: 429 },
    );
  }

  const db = await getDb();
  let token: string;
  try {
    ({ token } = await requestMagicLink(db, body.email));
  } catch (e) {
    // Surface a bad email as a 400; let anything unexpected propagate (no hiding).
    if (e instanceof Error && e.message === 'invalid email') {
      return NextResponse.json({ error: 'invalid email' }, { status: 400 });
    }
    throw e;
  }

  const base = process.env.APP_URL ?? new URL(req.url).origin;
  const url = `${base}/api/auth/callback?token=${token}`;
  await defaultTransport().sendMagicLink({ to: body.email, url });

  // Outside production, hand back the link so it's usable without an email
  // provider wired yet.
  const devLink = process.env.NODE_ENV !== 'production' ? url : undefined;
  return NextResponse.json({ ok: true, devLink });
}
