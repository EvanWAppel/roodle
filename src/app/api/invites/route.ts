import { NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { getCurrentUser } from '@/auth/currentUser';
import { createInvite, DuplicateInviteError } from '@/auth/invites';
import { defaultTransport } from '@/auth/email';

/** POST /api/invites { email } — invite a friend by email (GROUP-02). */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { email?: string } | null;
  if (!body || typeof body.email !== 'string') {
    return NextResponse.json({ error: 'missing email' }, { status: 400 });
  }

  const db = await getDb();
  let token: string;
  try {
    ({ token } = await createInvite(db, user.id, body.email));
  } catch (e) {
    if (e instanceof DuplicateInviteError) {
      return NextResponse.json(
        { error: 'a pending invite to that email already exists' },
        { status: 409 },
      );
    }
    if (e instanceof Error && e.message === 'invalid email') {
      return NextResponse.json({ error: 'invalid email' }, { status: 400 });
    }
    throw e; // never hide unexpected failures
  }

  const base = process.env.APP_URL ?? new URL(req.url).origin;
  const url = `${base}/api/invites/accept?token=${token}`;
  await defaultTransport().sendInvite({ to: body.email.trim().toLowerCase(), url });

  // Outside production, hand back the link so it's usable without live email.
  const devLink = process.env.NODE_ENV !== 'production' ? url : undefined;
  return NextResponse.json({ ok: true, devLink }, { status: 201 });
}
