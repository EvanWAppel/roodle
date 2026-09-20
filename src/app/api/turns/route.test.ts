// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '@/db/testDb';
import { __setTestDb } from '@/db/client';
import { ensureSeed } from '@/db/seed';
import type { Turn } from '@/db/schema';
import { POST as createTurnRoute, GET as listTurnsRoute } from './route';
import { POST as guessRoute } from './[id]/guess/route';

function post(url: string, body: unknown): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('SLICE-12 end-to-end: draw → pending → guess → point', () => {
  let playerA: string;
  let playerB: string;
  let gameId: string;

  beforeEach(async () => {
    const db = await createTestDb();
    __setTestDb(db);
    const seed = await ensureSeed(db);
    playerA = seed.playerA.id;
    playerB = seed.playerB.id;
    gameId = seed.game.id;
  });

  it('runs the whole loop: A draws, B sees it pending, B guesses right, a point lands', async () => {
    // A submits a drawing of the word "cat".
    const createRes = await createTurnRoute(
      post('http://test/api/turns', {
        gameId,
        drawerId: playerA,
        guesserId: playerB,
        word: 'cat',
        strokes: [
          { color: '#111827', width: 4, points: [{ x: 0, y: 0 }, { x: 10, y: 10 }] },
        ],
      }),
    );
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as Turn;
    expect(created.status).toBe('awaiting_guess');

    // B sees it in their pending list.
    const listRes = await listTurnsRoute(
      new Request(`http://test/api/turns?for=${playerB}`),
    );
    const pending = (await listRes.json()) as Turn[];
    expect(pending.map((t) => t.id)).toContain(created.id);

    // B guesses correctly (loose match: different case/whitespace).
    const guessRes = await guessRoute(
      post(`http://test/api/turns/${created.id}/guess`, { guess: ' CAT ' }),
      { params: Promise.resolve({ id: created.id }) },
    );
    const resolved = (await guessRes.json()) as Turn;
    expect(resolved.status).toBe('guessed');
    expect(resolved.pointsAwarded).toBe(1);

    // No longer pending for B.
    const afterRes = await listTurnsRoute(
      new Request(`http://test/api/turns?for=${playerB}`),
    );
    const after = (await afterRes.json()) as Turn[];
    expect(after.map((t) => t.id)).not.toContain(created.id);
  });

  it('rejects an invalid payload with 400', async () => {
    const res = await createTurnRoute(
      post('http://test/api/turns', { gameId, drawerId: playerA }),
    );
    expect(res.status).toBe(400);
  });
});
