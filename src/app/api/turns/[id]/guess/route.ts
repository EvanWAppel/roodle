import { NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { submitGuess, giveUp } from '@/db/turns';

/** POST /api/turns/:id/guess — submit a guess, or give up (SLICE-10). */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    guess?: string;
    action?: string;
  };

  const db = await getDb();

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
