import { NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { getCurrentUser } from '@/auth/currentUser';
import { createTurn, listPendingTurnsFor } from '@/db/turns';
import { areFriends, findGameForPair } from '@/db/friends';
import { validateDrawing } from '@/lib/strokes';

/**
 * POST /api/turns — submit a drawing as a new turn (SLICE-04 + GROUP-04).
 * The drawer is the session user; the guesser must be an accepted friend and
 * the game must be that pair's game.
 */
export async function POST(req: Request) {
  const drawer = await getCurrentUser();
  if (!drawer) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    gameId?: string;
    guesserId?: string;
    word?: string;
    strokes?: unknown;
  } | null;

  if (
    !body ||
    !body.gameId ||
    !body.guesserId ||
    typeof body.word !== 'string' ||
    !body.word.trim()
  ) {
    return NextResponse.json({ error: 'invalid turn payload' }, { status: 400 });
  }

  // Validate + size-budget the stroke data (DRAW-06 / PRD TQ4): reject malformed
  // or oversized payloads with a clear reason rather than persisting them.
  const drawing = validateDrawing(body.strokes);
  if (!drawing.ok) {
    return NextResponse.json(
      { error: `invalid strokes: ${drawing.error}` },
      { status: 400 },
    );
  }

  const db = await getDb();

  // Friend-only: the guesser must be an accepted friend of the drawer, and the
  // referenced game must be exactly that pair's game.
  if (!(await areFriends(db, drawer.id, body.guesserId))) {
    return NextResponse.json(
      { error: 'you can only draw for a friend' },
      { status: 403 },
    );
  }
  const pairGame = await findGameForPair(db, drawer.id, body.guesserId);
  if (!pairGame || pairGame.id !== body.gameId) {
    return NextResponse.json(
      { error: 'game does not match this pair' },
      { status: 403 },
    );
  }

  const turn = await createTurn(db, {
    gameId: body.gameId,
    drawerId: drawer.id,
    guesserId: body.guesserId,
    word: body.word,
    strokes: drawing.drawing,
  });
  return NextResponse.json(turn, { status: 201 });
}

/**
 * GET /api/turns?for=<guesserId> — list a guesser's pending turns (SLICE-05).
 * Only the guesser themselves may list their pending turns: these expose the
 * word being drawn, so a caller can't read another user's queue.
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  const guesserId = new URL(req.url).searchParams.get('for');
  if (!guesserId) {
    return NextResponse.json({ error: 'missing ?for' }, { status: 400 });
  }
  if (guesserId !== user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const db = await getDb();
  const turns = await listPendingTurnsFor(db, guesserId);
  return NextResponse.json(turns);
}
