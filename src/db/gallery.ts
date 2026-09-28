/**
 * Completed-drawing gallery data (DESIGN-10). A gallery entry is a resolved turn
 * (guessed / gave_up) with its strokes and both players' names, so the drawing
 * can be re-rendered alongside the word and outcome. Unresolved (awaiting_guess)
 * turns are never returned — their word is the answer the guesser hasn't seen yet,
 * so including them would leak it. Callers must authorize with `isGameMember`
 * before serving these to a user.
 */
import { eq } from 'drizzle-orm';
import type { DB } from './client';
import { users, turns } from './schema';
import type { Drawing } from '@/lib/strokes';

export interface GalleryEntry {
  turnId: string;
  word: string;
  drawing: Drawing;
  drawerName: string;
  guesserName: string;
  status: 'guessed' | 'gave_up';
  pointsAwarded: number;
  resolvedAt: Date | null;
}

/** Resolved turns for a game, newest first, with strokes and both names. */
export async function getGameGallery(
  db: DB,
  gameId: string,
): Promise<GalleryEntry[]> {
  const gameTurns = await db
    .select()
    .from(turns)
    .where(eq(turns.gameId, gameId));
  const players = await db.select().from(users);
  const nameById = new Map(players.map((p) => [p.id, p.displayName]));

  return gameTurns
    .filter((t) => t.status === 'guessed' || t.status === 'gave_up')
    .sort(
      (a, b) =>
        (b.resolvedAt?.getTime() ?? 0) - (a.resolvedAt?.getTime() ?? 0) ||
        b.createdAt.getTime() - a.createdAt.getTime(),
    )
    .map((t) => ({
      turnId: t.id,
      word: t.word,
      drawing: t.strokes,
      drawerName: nameById.get(t.drawerId) ?? 'someone',
      guesserName: nameById.get(t.guesserId) ?? 'someone',
      status: t.status as 'guessed' | 'gave_up',
      pointsAwarded: t.pointsAwarded,
      resolvedAt: t.resolvedAt,
    }));
}
