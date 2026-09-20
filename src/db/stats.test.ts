// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from './testDb';
import type { DB } from './client';
import { ensureSeed } from './seed';
import { createTurn, submitGuess, giveUp } from './turns';
import type { Drawing } from '@/lib/strokes';
import { getGameScoreboard, getPlayerStats, getGameHistory } from './stats';

const strokes: Drawing = [
  { color: '#111827', width: 4, points: [{ x: 0, y: 0 }] },
];

/** Play a turn: `drawer` draws `word` for `guesser`, who then acts. */
async function playTurn(
  db: DB,
  ids: { gameId: string; drawer: string; guesser: string },
  word: string,
  outcome: 'correct' | 'wrong' | 'giveup',
) {
  const turn = await createTurn(db, {
    gameId: ids.gameId,
    drawerId: ids.drawer,
    guesserId: ids.guesser,
    word,
    strokes,
  });
  if (outcome === 'correct') await submitGuess(db, turn.id, word);
  else if (outcome === 'wrong') await submitGuess(db, turn.id, 'nope');
  else await giveUp(db, turn.id);
  return turn;
}

describe('stats (SCORE group)', () => {
  let db: DB;
  let a: string;
  let b: string;
  let gameId: string;

  beforeEach(async () => {
    db = await createTestDb();
    const seed = await ensureSeed(db);
    a = seed.playerA.id;
    b = seed.playerB.id;
    gameId = seed.game.id;
  });

  it('scoreboard sums points and correct guesses per player, high first', async () => {
    // A draws for B: B guesses two correct, gives up one.
    await playTurn(db, { gameId, drawer: a, guesser: b }, 'cat', 'correct');
    await playTurn(db, { gameId, drawer: a, guesser: b }, 'dog', 'correct');
    await playTurn(db, { gameId, drawer: a, guesser: b }, 'sun', 'giveup');
    // B draws for A: A guesses one correct.
    await playTurn(db, { gameId, drawer: b, guesser: a }, 'moon', 'correct');

    const board = await getGameScoreboard(db, gameId);
    expect(board).toHaveLength(2);
    expect(board[0].playerId).toBe(b); // B has more points
    expect(board[0].points).toBe(2);
    expect(board[0].correctGuesses).toBe(2);
    const aRow = board.find((r) => r.playerId === a)!;
    expect(aRow.points).toBe(1);
  });

  it('player stats track points, correct guesses, games, and streaks', async () => {
    // B: correct, correct, gave up (resets), correct → current streak 1, longest 2.
    await playTurn(db, { gameId, drawer: a, guesser: b }, 'cat', 'correct');
    await playTurn(db, { gameId, drawer: a, guesser: b }, 'dog', 'correct');
    await playTurn(db, { gameId, drawer: a, guesser: b }, 'sun', 'giveup');
    await playTurn(db, { gameId, drawer: a, guesser: b }, 'car', 'correct');

    const stats = await getPlayerStats(db, b);
    expect(stats.points).toBe(3);
    expect(stats.correctGuesses).toBe(3);
    expect(stats.longestStreak).toBe(2);
    expect(stats.currentStreak).toBe(1);
    expect(stats.gamesPlayed).toBe(1);
  });

  it('history lists resolved turns newest-first with guesser names', async () => {
    await playTurn(db, { gameId, drawer: a, guesser: b }, 'cat', 'correct');
    await playTurn(db, { gameId, drawer: a, guesser: b }, 'dog', 'giveup');
    // An unresolved turn should not appear.
    await createTurn(db, {
      gameId,
      drawerId: a,
      guesserId: b,
      word: 'tree',
      strokes,
    });

    const history = await getGameHistory(db, gameId);
    expect(history).toHaveLength(2);
    expect(history[0].word).toBe('dog');
    expect(history[0].status).toBe('gave_up');
    expect(history[0].guesserName).toBe('Christine');
    expect(history.some((h) => h.word === 'tree')).toBe(false);
  });
});
