// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { users, games } from './schema';
import type { DB } from './client';
import { createTestDb } from './testDb';
import type { Drawing } from '@/lib/strokes';
import {
  createTurn,
  listPendingTurnsFor,
  submitGuess,
  giveUp,
} from './turns';

const sampleStrokes: Drawing = [
  {
    color: '#111827',
    width: 4,
    points: [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ],
  },
  { color: '#3b82f6', width: 2, points: [{ x: 2, y: 2 }] },
];

async function seed(db: DB) {
  const [alice] = await db
    .insert(users)
    .values({ email: 'alice@example.com', displayName: 'Alice' })
    .returning();
  const [bob] = await db
    .insert(users)
    .values({ email: 'bob@example.com', displayName: 'Bob' })
    .returning();
  const [game] = await db
    .insert(games)
    .values({ playerA: alice.id, playerB: bob.id })
    .returning();
  return { alice, bob, game };
}

describe('turns data-access module', () => {
  let db: DB;
  beforeEach(async () => {
    db = await createTestDb();
  });

  it('createTurn persists a turn awaiting a guess with round-tripped fields', async () => {
    const { alice, bob, game } = await seed(db);
    const turn = await createTurn(db, {
      gameId: game.id,
      drawerId: alice.id,
      guesserId: bob.id,
      word: 'apple',
      strokes: sampleStrokes,
    });

    expect(turn.id).toBeDefined();
    expect(turn.status).toBe('awaiting_guess');
    expect(turn.pointsAwarded).toBe(0);
    expect(turn.resolvedAt).toBeNull();
    expect(turn.word).toBe('apple');
    expect(turn.strokes).toEqual(sampleStrokes);
    expect(turn.guesserId).toBe(bob.id);
    expect(turn.drawerId).toBe(alice.id);
  });

  it('createTurn throws on an empty word', async () => {
    const { alice, bob, game } = await seed(db);
    await expect(
      createTurn(db, {
        gameId: game.id,
        drawerId: alice.id,
        guesserId: bob.id,
        word: '   ',
        strokes: sampleStrokes,
      }),
    ).rejects.toThrow();
  });

  it('createTurn throws on non-array strokes', async () => {
    const { alice, bob, game } = await seed(db);
    await expect(
      createTurn(db, {
        gameId: game.id,
        drawerId: alice.id,
        guesserId: bob.id,
        word: 'apple',
        // deliberately wrong type to exercise validation
        strokes: 'not-an-array' as unknown as Drawing,
      }),
    ).rejects.toThrow();
  });

  it('listPendingTurnsFor returns only that guesser awaiting turns', async () => {
    const { alice, bob, game } = await seed(db);
    // one awaiting turn for bob
    const bobTurn = await createTurn(db, {
      gameId: game.id,
      drawerId: alice.id,
      guesserId: bob.id,
      word: 'apple',
      strokes: sampleStrokes,
    });
    // one awaiting turn for alice (the other user)
    await createTurn(db, {
      gameId: game.id,
      drawerId: bob.id,
      guesserId: alice.id,
      word: 'banana',
      strokes: sampleStrokes,
    });

    const pending = await listPendingTurnsFor(db, bob.id);
    expect(pending).toHaveLength(1);
    expect(pending[0].id).toBe(bobTurn.id);
    expect(pending[0].guesserId).toBe(bob.id);
    expect(pending[0].status).toBe('awaiting_guess');
  });

  it('listPendingTurnsFor excludes resolved turns', async () => {
    const { alice, bob, game } = await seed(db);
    const turn = await createTurn(db, {
      gameId: game.id,
      drawerId: alice.id,
      guesserId: bob.id,
      word: 'apple',
      strokes: sampleStrokes,
    });
    await submitGuess(db, turn.id, 'apple');
    const pending = await listPendingTurnsFor(db, bob.id);
    expect(pending).toHaveLength(0);
  });

  it('submitGuess with the correct word marks the turn guessed and awards a point', async () => {
    const { alice, bob, game } = await seed(db);
    const turn = await createTurn(db, {
      gameId: game.id,
      drawerId: alice.id,
      guesserId: bob.id,
      word: 'apple',
      strokes: sampleStrokes,
    });

    const solved = await submitGuess(db, turn.id, 'APPLE');
    expect(solved.status).toBe('guessed');
    expect(solved.pointsAwarded).toBe(1);
    expect(solved.resolvedAt).toBeInstanceOf(Date);
  });

  it('submitGuess with a wrong guess leaves the turn awaiting with no points', async () => {
    const { alice, bob, game } = await seed(db);
    const turn = await createTurn(db, {
      gameId: game.id,
      drawerId: alice.id,
      guesserId: bob.id,
      word: 'apple',
      strokes: sampleStrokes,
    });

    const still = await submitGuess(db, turn.id, 'orange');
    expect(still.status).toBe('awaiting_guess');
    expect(still.pointsAwarded).toBe(0);
    expect(still.resolvedAt).toBeNull();
  });

  it('submitGuess throws when the turn does not exist', async () => {
    await seed(db);
    await expect(
      submitGuess(db, '00000000-0000-0000-0000-000000000000', 'apple'),
    ).rejects.toThrow();
  });

  it('giveUp marks the turn gave_up with a resolved time and no points', async () => {
    const { alice, bob, game } = await seed(db);
    const turn = await createTurn(db, {
      gameId: game.id,
      drawerId: alice.id,
      guesserId: bob.id,
      word: 'apple',
      strokes: sampleStrokes,
    });

    const abandoned = await giveUp(db, turn.id);
    expect(abandoned.status).toBe('gave_up');
    expect(abandoned.pointsAwarded).toBe(0);
    expect(abandoned.resolvedAt).toBeInstanceOf(Date);
  });
});
