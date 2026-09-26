import { NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { getCurrentUser } from '@/auth/currentUser';
import { selectWordForGame, isGameMember } from '@/db/packs';
import type { Difficulty } from '@/db/schema';

const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];

/**
 * GET /api/packs/word?gameId=<id>[&difficulty=][&exclude=] — offer the drawer a
 * random word from the game's enabled packs (WORD-03), honoring difficulty. The
 * caller must be a player in that game. Returns { word: null } when no word
 * matches the selection (e.g. a difficulty with no eligible words).
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const url = new URL(req.url);
  const gameId = url.searchParams.get('gameId');
  if (!gameId) {
    return NextResponse.json({ error: 'missing gameId' }, { status: 400 });
  }
  const rawDifficulty = url.searchParams.get('difficulty');
  const difficulty =
    rawDifficulty && DIFFICULTIES.includes(rawDifficulty as Difficulty)
      ? (rawDifficulty as Difficulty)
      : undefined;
  const exclude = url.searchParams.get('exclude') ?? undefined;

  const db = await getDb();
  if (!(await isGameMember(db, gameId, user.id))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const word = await selectWordForGame(db, { gameId, difficulty, exclude });
  return NextResponse.json({
    word: word ? { text: word.text, difficulty: word.difficulty } : null,
  });
}
