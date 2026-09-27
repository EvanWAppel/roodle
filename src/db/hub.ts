import { and, asc, eq, inArray } from 'drizzle-orm';
import type { DB } from './client';
import { turns } from './schema';
import { listFriendsWithGames } from './friends';

export interface GameCard {
  gameId: string;
  name: string;
  incoming: number;
  waiting: number;
  turnId: string | null;
}

/** Only the signed-in player's friendships and pending metadata; no answers. */
export async function listGameCards(
  db: DB,
  userId: string,
): Promise<GameCard[]> {
  const friends = await listFriendsWithGames(db, userId);
  if (!friends.length) return [];
  const pending = await db
    .select({ id: turns.id, gameId: turns.gameId, guesserId: turns.guesserId })
    .from(turns)
    .where(
      and(
        inArray(
          turns.gameId,
          friends.map((f) => f.gameId),
        ),
        eq(turns.status, 'awaiting_guess'),
      ),
    )
    .orderBy(asc(turns.createdAt));
  return friends
    .map(({ opponent, gameId }) => {
      const incoming = pending.filter(
        (t) => t.gameId === gameId && t.guesserId === userId,
      );
      return {
        gameId,
        name: opponent.displayName,
        incoming: incoming.length,
        waiting: pending.filter(
          (t) => t.gameId === gameId && t.guesserId !== userId,
        ).length,
        turnId: incoming[0]?.id ?? null,
      };
    })
    .sort((a, b) => b.incoming - a.incoming || a.name.localeCompare(b.name));
}
