import { NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { ensureSeed } from '@/db/seed';

/**
 * GET /api/session?as=evan|christine — dev-identity bootstrap (SLICE-03).
 * Ensures the two seed players + game exist and returns who "me" is, the
 * opponent, and the game id. Replaced by real auth in the AUTH group.
 */
export async function GET(req: Request) {
  const as = new URL(req.url).searchParams.get('as') ?? 'evan';
  const db = await getDb();
  const { playerA, playerB, game } = await ensureSeed(db);
  const meIsA = as !== 'christine';
  const me = meIsA ? playerA : playerB;
  const opponent = meIsA ? playerB : playerA;
  return NextResponse.json({
    me: { id: me.id, displayName: me.displayName },
    opponent: { id: opponent.id, displayName: opponent.displayName },
    gameId: game.id,
  });
}
