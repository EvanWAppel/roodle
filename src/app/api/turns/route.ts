import { NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { createTurn, listPendingTurnsFor } from '@/db/turns';

/** POST /api/turns — submit a drawing as a new turn (SLICE-04). */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    gameId?: string;
    drawerId?: string;
    guesserId?: string;
    word?: string;
    strokes?: unknown;
  } | null;

  if (
    !body ||
    !body.gameId ||
    !body.drawerId ||
    !body.guesserId ||
    typeof body.word !== 'string' ||
    !body.word.trim() ||
    !Array.isArray(body.strokes)
  ) {
    return NextResponse.json({ error: 'invalid turn payload' }, { status: 400 });
  }

  const db = await getDb();
  const turn = await createTurn(db, {
    gameId: body.gameId,
    drawerId: body.drawerId,
    guesserId: body.guesserId,
    word: body.word,
    strokes: body.strokes,
  });
  return NextResponse.json(turn, { status: 201 });
}

/** GET /api/turns?for=<guesserId> — list a guesser's pending turns (SLICE-05). */
export async function GET(req: Request) {
  const guesserId = new URL(req.url).searchParams.get('for');
  if (!guesserId) {
    return NextResponse.json({ error: 'missing ?for' }, { status: 400 });
  }
  const db = await getDb();
  const turns = await listPendingTurnsFor(db, guesserId);
  return NextResponse.json(turns);
}
