import { NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { getCurrentUser } from '@/auth/currentUser';
import { areFriends, findGameForPair } from '@/db/friends';
import { games } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { pickWordForGame } from '@/db/packs';
import { pickRandomWord } from '@/lib/words';
import type { Difficulty } from '@/db/schema';

const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];
function asDifficulty(x: string | null): Difficulty {
  return x && (DIFFICULTIES as readonly string[]).includes(x)
    ? (x as Difficulty)
    : 'medium';
}

/**
 * GET /api/words/next?game=<id>&difficulty=<d>&exclude=<word> — the WORD-03
 * draw-flow integration point. Returns the next word to draw for a game,
 * honoring that game's enabled packs at the chosen difficulty (WORD-03/05).
 *
 * The signed-in user must be a participant in the game. When the game's enabled
 * packs yield no word at the difficulty (e.g. all packs disabled), we fall back
 * to the SLICE-02 built-in `pickRandomWord()` so the draw page always has a word
 * to offer and never dead-ends — the source is reported in the response.
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const url = new URL(req.url);
  const gameId = url.searchParams.get('game');
  const difficulty = asDifficulty(url.searchParams.get('difficulty'));
  const exclude = url.searchParams.get('exclude') ?? undefined;

  if (!gameId) {
    return NextResponse.json({ error: 'missing ?game' }, { status: 400 });
  }

  const db = await getDb();

  // Participant check: the user must be one of the game's two players.
  const [game] = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
  if (!game) {
    return NextResponse.json({ error: 'unknown game' }, { status: 404 });
  }
  if (game.playerA !== user.id && game.playerB !== user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  // The opponent must still be an accepted friend (mirrors turns route).
  const opponentId = game.playerA === user.id ? game.playerB : game.playerA;
  if (!(await areFriends(db, user.id, opponentId))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const pairGame = await findGameForPair(db, user.id, opponentId);
  if (!pairGame || pairGame.id !== gameId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const fromPacks = await pickWordForGame(db, gameId, difficulty, { exclude });
  if (fromPacks) {
    return NextResponse.json({ word: fromPacks, difficulty, source: 'pack' });
  }
  // No enabled-pack word at this difficulty; keep the draw flow alive.
  const fallback = pickRandomWord(exclude);
  return NextResponse.json({ word: fallback, difficulty, source: 'builtin' });
}
