import { NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { getCurrentUser } from '@/auth/currentUser';
import {
  setPackEnabled,
  isGameMember,
  getPack,
  isPackUsableBy,
} from '@/db/packs';

/**
 * POST /api/packs/enable { gameId, packId, enabled } — enable or disable a pack
 * for a game (WORD-05/06). The caller must be a player in that game.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    gameId?: string;
    packId?: string;
    enabled?: boolean;
  } | null;

  if (
    !body ||
    typeof body.gameId !== 'string' ||
    typeof body.packId !== 'string' ||
    typeof body.enabled !== 'boolean'
  ) {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 });
  }

  const db = await getDb();
  if (!(await isGameMember(db, body.gameId, user.id))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // The pack must exist and be usable by this user (built-in or their own) —
  // otherwise a member could enable another user's private custom pack into
  // their game (D11-class IDOR).
  const pack = await getPack(db, body.packId);
  if (!pack) {
    return NextResponse.json({ error: 'pack not found' }, { status: 404 });
  }
  if (!isPackUsableBy(pack, user.id)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  await setPackEnabled(db, body.gameId, body.packId, body.enabled);
  return NextResponse.json({ ok: true });
}
