import { NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { getCurrentUser } from '@/auth/currentUser';
import { submitGuess, giveUp, getTurn } from '@/db/turns';

/**
 * POST /api/turns/:id/guess — submit a guess, or give up (SLICE-10).
 * Only the turn's guesser may act on it, so no one can guess or force a give-up
 * on someone else's turn.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    guess?: string;
    action?: string;
  };

  const db = await getDb();

  const existing = await getTurn(db, id);
  if (!existing) {
    return NextResponse.json({ error: 'turn not found' }, { status: 404 });
  }
  if (existing.guesserId !== user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  if (body.action === 'give_up') {
    const turn = await giveUp(db, id);
    return NextResponse.json(turn);
  }

  if (typeof body.guess !== 'string') {
    return NextResponse.json({ error: 'missing guess' }, { status: 400 });
  }

  const turn = await submitGuess(db, id, body.guess);
  return NextResponse.json(turn);
}
