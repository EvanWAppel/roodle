/**
 * Data-access module for turns: create a drawing turn, list a guesser's
 * pending turns, submit a guess, and give up. Pure DB access — validation
 * throws clearly and errors are never swallowed.
 */
import { eq, and } from 'drizzle-orm';
import { turns } from './schema';
import type { Turn } from './schema';
import type { DB } from './client';
import type { Drawing } from '@/lib/strokes';
import { guessMatches } from '@/lib/guess';

export interface CreateTurnInput {
  gameId: string;
  drawerId: string;
  guesserId: string;
  word: string;
  strokes: Drawing;
}

/** Insert a new turn awaiting a guess. Validates input and returns the row. */
export async function createTurn(
  db: DB,
  input: CreateTurnInput,
): Promise<Turn> {
  const { gameId, drawerId, guesserId, word, strokes } = input;

  if (typeof word !== 'string' || word.trim().length === 0) {
    throw new Error('createTurn: word must be a non-empty string');
  }
  if (!Array.isArray(strokes)) {
    throw new Error('createTurn: strokes must be an array (Drawing)');
  }

  const [row] = await db
    .insert(turns)
    .values({
      gameId,
      drawerId,
      guesserId,
      word,
      strokes,
      status: 'awaiting_guess',
      pointsAwarded: 0,
    })
    .returning();

  return row;
}

/** Turns this guesser still owes a guess on, oldest-first is not guaranteed. */
export async function listPendingTurnsFor(
  db: DB,
  guesserId: string,
): Promise<Turn[]> {
  return db
    .select()
    .from(turns)
    .where(
      and(
        eq(turns.guesserId, guesserId),
        eq(turns.status, 'awaiting_guess'),
      ),
    );
}

async function loadTurn(db: DB, turnId: string): Promise<Turn> {
  const [row] = await db.select().from(turns).where(eq(turns.id, turnId));
  if (!row) {
    throw new Error(`turn not found: ${turnId}`);
  }
  return row;
}

/**
 * Submit a guess. On a match the turn becomes 'guessed' with 1 point and a
 * resolved time; otherwise it stays awaiting so the guesser can try again.
 */
export async function submitGuess(
  db: DB,
  turnId: string,
  guess: string,
): Promise<Turn> {
  const turn = await loadTurn(db, turnId);

  if (!guessMatches(turn.word, guess)) {
    return turn;
  }

  const [row] = await db
    .update(turns)
    .set({
      status: 'guessed',
      pointsAwarded: 1,
      resolvedAt: new Date(),
    })
    .where(eq(turns.id, turnId))
    .returning();

  return row;
}

/** Abandon a turn: 'gave_up', no points, resolved now. */
export async function giveUp(db: DB, turnId: string): Promise<Turn> {
  const [row] = await db
    .update(turns)
    .set({
      status: 'gave_up',
      pointsAwarded: 0,
      resolvedAt: new Date(),
    })
    .where(eq(turns.id, turnId))
    .returning();

  if (!row) {
    throw new Error(`turn not found: ${turnId}`);
  }

  return row;
}
