import { NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { resolveBaseUrl } from '@/lib/baseUrl';
import { getCurrentUser } from '@/auth/currentUser';
import {
  createInvite,
  listPendingInvites,
  inviteExpiryLabel,
  DuplicateInviteError,
} from '@/auth/invites';
import { defaultTransport, emailConfigured } from '@/auth/email';

/** GET /api/invites — the signed-in user's outstanding invitations (DESIGN-05). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  const db = await getDb();
  const now = Date.now();
  const pending = await listPendingInvites(db, user.id);
  const invites = pending.map((invite) => ({
    id: invite.id,
    inviteeEmail: invite.inviteeEmail,
    expiresAt: invite.expiresAt.toISOString(),
    expired: invite.expiresAt.getTime() <= now,
    label: inviteExpiryLabel(invite.expiresAt, now),
  }));
  return NextResponse.json({ invites });
}

/** POST /api/invites { email } — invite a friend by email (GROUP-02). */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    email?: string;
    resend?: boolean;
  } | null;
  if (!body || typeof body.email !== 'string') {
    return NextResponse.json({ error: 'missing email' }, { status: 400 });
  }

  if (process.env.NODE_ENV === 'production' && !emailConfigured()) {
    return NextResponse.json(
      { error: 'Email delivery is unavailable. Please try again later.' },
      { status: 503 },
    );
  }
  const db = await getDb();
  const email = body.email;
  const base = resolveBaseUrl(req);
  let url: string;
  let deliveryFailed = false;
  try {
    url = await db.transaction(async (tx) => {
      const { token } = await createInvite(
        tx,
        user.id,
        email,
        Date.now(),
        body.resend === true,
      );
      const link = `${base}/api/invites/accept?token=${token}`;
      try {
        await defaultTransport().sendInvite({
          to: email.trim().toLowerCase(),
          url: link,
        });
      } catch {
        deliveryFailed = true;
        throw new Error('invite delivery failed');
      }
      return link;
    });
  } catch (e) {
    if (deliveryFailed) {
      return NextResponse.json(
        { error: 'The invite email could not be sent. Please try again.' },
        { status: 502 },
      );
    }
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

  // Outside production, hand back the link so it's usable without live email.
  const devLink = process.env.NODE_ENV !== 'production' ? url : undefined;
  return NextResponse.json({ ok: true, devLink }, { status: 201 });
}
