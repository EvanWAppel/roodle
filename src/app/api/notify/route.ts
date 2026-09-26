import { NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { getCurrentUser } from '@/auth/currentUser';
import { setNotifyEnabled } from '@/notify/nudge';

/**
 * GET /api/notify — the signed-in user's current turn-nudge preference
 * (NOTIF-05). { notifyEnabled: boolean }.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  return NextResponse.json({ notifyEnabled: user.notifyEnabled });
}

/**
 * PATCH /api/notify { enabled: boolean } — toggle the signed-in user's
 * turn-nudge preference (NOTIF-05). Only the user themselves can change it.
 */
export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    enabled?: unknown;
  } | null;
  if (!body || typeof body.enabled !== 'boolean') {
    return NextResponse.json(
      { error: 'expected { enabled: boolean }' },
      { status: 400 },
    );
  }

  const db = await getDb();
  const notifyEnabled = await setNotifyEnabled(db, user.id, body.enabled);
  return NextResponse.json({ notifyEnabled });
}
