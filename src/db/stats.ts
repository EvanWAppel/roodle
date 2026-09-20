import { eq, or } from 'drizzle-orm';
import type { DB } from './client';
import { users, games, turns } from './schema';

export interface ScoreRow {
  playerId: string;
  displayName: string;
  points: number;
  correctGuesses: number;
}

export interface PlayerStats {
  gamesPlayed: number;
  correctGuesses: number;
  points: number;
  currentStreak: number;
  longestStreak: number;
}

export interface HistoryRow {
  turnId: string;
  word: string;
  guesserName: string;
  status: 'guessed' | 'gave_up';
  pointsAwarded: number;
  resolvedAt: Date | null;
}

/** Scoreboard for a single game: each player's points + correct guesses, high first. */
export async function getGameScoreboard(
  db: DB,
  gameId: string,
): Promise<ScoreRow[]> {
  const [game] = await db.select().from(games).where(eq(games.id, gameId));
  if (!game) return [];

  const players = await db
    .select()
    .from(users)
    .where(or(eq(users.id, game.playerA), eq(users.id, game.playerB)));
  const gameTurns = await db
    .select()
    .from(turns)
    .where(eq(turns.gameId, gameId));

  const rows = players.map((p) => {
    const mine = gameTurns.filter((t) => t.guesserId === p.id);
    return {
      playerId: p.id,
      displayName: p.displayName,
      points: mine.reduce((sum, t) => sum + t.pointsAwarded, 0),
      correctGuesses: mine.filter((t) => t.status === 'guessed').length,
    };
  });
  return rows.sort((a, b) => b.points - a.points);
}

/** Lifetime stats for one player across all their games. */
export async function getPlayerStats(
  db: DB,
  userId: string,
): Promise<PlayerStats> {
  const guesserTurns = await db
    .select()
    .from(turns)
    .where(eq(turns.guesserId, userId));
  const myGames = await db
    .select({ id: games.id })
    .from(games)
    .where(or(eq(games.playerA, userId), eq(games.playerB, userId)));

  const points = guesserTurns.reduce((sum, t) => sum + t.pointsAwarded, 0);
  const correctGuesses = guesserTurns.filter(
    (t) => t.status === 'guessed',
  ).length;

  // Streaks run over resolved turns (guessed / gave_up) in resolution order.
  const resolved = guesserTurns
    .filter((t) => t.status === 'guessed' || t.status === 'gave_up')
    .sort(
      (a, b) =>
        (a.resolvedAt?.getTime() ?? 0) - (b.resolvedAt?.getTime() ?? 0) ||
        a.createdAt.getTime() - b.createdAt.getTime(),
    );
  let currentStreak = 0;
  let longestStreak = 0;
  for (const t of resolved) {
    if (t.status === 'guessed') {
      currentStreak += 1;
      longestStreak = Math.max(longestStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
  }

  return {
    gamesPlayed: myGames.length,
    correctGuesses,
    points,
    currentStreak,
    longestStreak,
  };
}

/** Resolved turns for a game, newest first, with the guesser's name. */
export async function getGameHistory(
  db: DB,
  gameId: string,
): Promise<HistoryRow[]> {
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
      guesserName: nameById.get(t.guesserId) ?? 'someone',
      status: t.status as 'guessed' | 'gave_up',
      pointsAwarded: t.pointsAwarded,
      resolvedAt: t.resolvedAt,
    }));
}
