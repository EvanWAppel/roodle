// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '@/db/testDb';
import { __setTestDb } from '@/db/client';
import { createFriendPair } from '@/db/friends';
import { users, games } from '@/db/schema';
import type { Turn, User } from '@/db/schema';
import { CaptureTransport } from '@/auth/email';
import { MAX_POINTS_PER_STROKE } from '@/lib/strokes';

// The turns route derives the drawer from the session. Tests set who "me" is.
const currentUser = vi.fn<() => Promise<User | null>>();
vi.mock('@/auth/currentUser', () => ({
  getCurrentUser: () => currentUser(),
}));

// NOTIF-03: the route nudges the guesser via the default transport. Capture it.
const capture = new CaptureTransport();
vi.mock('@/auth/email', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/auth/email')>();
  return { ...actual, defaultTransport: () => capture };
});

import { POST as createTurnRoute, GET as listTurnsRoute } from './route';
import { POST as guessRoute } from './[id]/guess/route';

function post(url: string, body: unknown): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const someStrokes = [
  { color: '#111827', width: 4, points: [{ x: 0, y: 0 }, { x: 10, y: 10 }] },
];

describe('SLICE-12 end-to-end: draw → pending → guess → point (friend-enforced)', () => {
  let userA: User;
  let userB: User;
  let playerA: string;
  let playerB: string;
  let gameId: string;

  beforeEach(async () => {
    const db = await createTestDb();
    __setTestDb(db);
    const pair = await createFriendPair(db, {
      emailA: 'evan@example.com',
      emailB: 'christine@example.com',
      displayA: 'Evan',
      displayB: 'Christine',
    });
    userA = pair.userA;
    userB = pair.userB;
    playerA = pair.userA.id;
    playerB = pair.userB.id;
    gameId = pair.game.id;
    capture.sentNudges.length = 0;
    currentUser.mockReset();
    currentUser.mockResolvedValue(pair.userA); // A is the drawer/session user
  });

  it('runs the whole loop: A draws, B sees it pending, B guesses right, a point lands', async () => {
    const createRes = await createTurnRoute(
      post('http://test/api/turns', {
        gameId,
        guesserId: playerB,
        word: 'cat',
        strokes: someStrokes,
      }),
    );
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as Turn;
    expect(created.status).toBe('awaiting_guess');
    expect(created.drawerId).toBe(playerA); // drawer came from the session

    // B is now the session user: they list their own pending turns and guess.
    currentUser.mockResolvedValue(userB);
    const listRes = await listTurnsRoute(
      new Request(`http://test/api/turns?for=${playerB}`),
    );
    const pending = (await listRes.json()) as Turn[];
    expect(pending.map((t) => t.id)).toContain(created.id);

    const guessRes = await guessRoute(
      post(`http://test/api/turns/${created.id}/guess`, { guess: ' CAT ' }),
      { params: Promise.resolve({ id: created.id }) },
    );
    const resolved = (await guessRes.json()) as Turn;
    expect(resolved.status).toBe('guessed');
    expect(resolved.pointsAwarded).toBe(1);

    const afterRes = await listTurnsRoute(
      new Request(`http://test/api/turns?for=${playerB}`),
    );
    const after = (await afterRes.json()) as Turn[];
    expect(after.map((t) => t.id)).not.toContain(created.id);
  });

  it('rejects an invalid payload with 400', async () => {
    const res = await createTurnRoute(
      post('http://test/api/turns', { gameId }),
    );
    expect(res.status).toBe(400);
  });

  it('GET /api/turns 401s unauthenticated and 403s listing another user’s queue', async () => {
    currentUser.mockResolvedValue(null);
    const unauth = await listTurnsRoute(
      new Request(`http://test/api/turns?for=${playerB}`),
    );
    expect(unauth.status).toBe(401);

    // Signed in as A, but trying to read B's pending turns (which leak the word).
    currentUser.mockResolvedValue(userA);
    const forbidden = await listTurnsRoute(
      new Request(`http://test/api/turns?for=${playerB}`),
    );
    expect(forbidden.status).toBe(403);
  });

  it('guess route 401s unauthenticated and 403s a non-guesser', async () => {
    const created = (await (
      await createTurnRoute(
        post('http://test/api/turns', {
          gameId,
          guesserId: playerB,
          word: 'cat',
          strokes: someStrokes,
        }),
      )
    ).json()) as Turn;

    currentUser.mockResolvedValue(null);
    const unauth = await guessRoute(
      post(`http://test/api/turns/${created.id}/guess`, { guess: 'cat' }),
      { params: Promise.resolve({ id: created.id }) },
    );
    expect(unauth.status).toBe(401);

    // A is the drawer, not the guesser — must not be able to guess/give up.
    currentUser.mockResolvedValue(userA);
    const forbidden = await guessRoute(
      post(`http://test/api/turns/${created.id}/guess`, { action: 'give_up' }),
      { params: Promise.resolve({ id: created.id }) },
    );
    expect(forbidden.status).toBe(403);
  });
});

describe('friend-only enforcement on POST /api/turns (GROUP-04)', () => {
  let db: Awaited<ReturnType<typeof createTestDb>>;
  let drawer: User;
  let friend: User;
  let gameId: string;

  beforeEach(async () => {
    db = await createTestDb();
    __setTestDb(db);
    const pair = await createFriendPair(db, {
      emailA: 'drawer@example.com',
      emailB: 'friend@example.com',
      displayA: 'Drawer',
      displayB: 'Friend',
    });
    drawer = pair.userA;
    friend = pair.userB;
    gameId = pair.game.id;
    capture.sentNudges.length = 0;
    currentUser.mockReset();
    currentUser.mockResolvedValue(drawer);
  });

  it('401 when unauthenticated', async () => {
    currentUser.mockResolvedValue(null);
    const res = await createTurnRoute(
      post('http://test/api/turns', {
        gameId,
        guesserId: friend.id,
        word: 'cat',
        strokes: someStrokes,
      }),
    );
    expect(res.status).toBe(401);
  });

  it('403 when the guesser is not an accepted friend', async () => {
    const [stranger] = await db
      .insert(users)
      .values({ email: 'stranger@example.com', displayName: 'Stranger' })
      .returning();
    const res = await createTurnRoute(
      post('http://test/api/turns', {
        gameId,
        guesserId: stranger.id,
        word: 'cat',
        strokes: someStrokes,
      }),
    );
    expect(res.status).toBe(403);
  });

  it('403 when the game is not this pair’s game', async () => {
    // A game between the drawer and someone else — wrong game for this pair.
    const [other] = await db
      .insert(users)
      .values({ email: 'other@example.com', displayName: 'Other' })
      .returning();
    const [wrongGame] = await db
      .insert(games)
      .values({ playerA: drawer.id, playerB: other.id })
      .returning();
    const res = await createTurnRoute(
      post('http://test/api/turns', {
        gameId: wrongGame.id,
        guesserId: friend.id,
        word: 'cat',
        strokes: someStrokes,
      }),
    );
    expect(res.status).toBe(403);
  });

  it('succeeds between friends on their game', async () => {
    const res = await createTurnRoute(
      post('http://test/api/turns', {
        gameId,
        guesserId: friend.id,
        word: 'cat',
        strokes: someStrokes,
      }),
    );
    expect(res.status).toBe(201);
  });

  it('400 when strokes is malformed (not an array)', async () => {
    const res = await createTurnRoute(
      post('http://test/api/turns', {
        gameId,
        guesserId: friend.id,
        word: 'cat',
        strokes: 'not-an-array',
      }),
    );
    expect(res.status).toBe(400);
  });

  it('400 when a stroke has a bad shape (non-finite coords)', async () => {
    const res = await createTurnRoute(
      post('http://test/api/turns', {
        gameId,
        guesserId: friend.id,
        word: 'cat',
        strokes: [{ color: '#111827', width: 4, points: [{ x: NaN, y: 0 }] }],
      }),
    );
    expect(res.status).toBe(400);
  });

  it('400 when strokes exceed the size budget (too many total points)', async () => {
    const huge = Array.from({ length: 25 }, () => ({
      color: '#111827',
      width: 4,
      points: Array.from({ length: MAX_POINTS_PER_STROKE }, () => ({
        x: 1,
        y: 1,
      })),
    }));
    const res = await createTurnRoute(
      post('http://test/api/turns', {
        gameId,
        guesserId: friend.id,
        word: 'cat',
        strokes: huge,
      }),
    );
    expect(res.status).toBe(400);
  });

  it('still 201 on a valid payload after hardening', async () => {
    const res = await createTurnRoute(
      post('http://test/api/turns', {
        gameId,
        guesserId: friend.id,
        word: 'cat',
        strokes: someStrokes,
      }),
    );
    expect(res.status).toBe(201);
  });
});

describe('turn-nudge email on POST /api/turns (NOTIF-03/04/05)', () => {
  let db: Awaited<ReturnType<typeof createTestDb>>;
  let drawer: User;
  let friend: User;
  let gameId: string;

  beforeEach(async () => {
    db = await createTestDb();
    __setTestDb(db);
    const pair = await createFriendPair(db, {
      emailA: 'drawer@example.com',
      emailB: 'guesser@example.com',
      displayA: 'Drawer',
      displayB: 'Guesser',
    });
    drawer = pair.userA;
    friend = pair.userB;
    gameId = pair.game.id;
    capture.sentNudges.length = 0;
    currentUser.mockReset();
    currentUser.mockResolvedValue(drawer);
  });

  it('sends exactly one nudge to the guesser with a deep link to the created turn', async () => {
    const res = await createTurnRoute(
      post('http://test/api/turns', {
        gameId,
        guesserId: friend.id,
        word: 'cat',
        strokes: someStrokes,
      }),
    );
    expect(res.status).toBe(201);
    const created = (await res.json()) as Turn;

    // Exactly one email — one per created turn, not per poll/list.
    expect(capture.sentNudges).toHaveLength(1);
    expect(capture.sentNudges[0].to).toBe('guesser@example.com');
    expect(capture.sentNudges[0].url).toBe(
      `http://test/play?turn=${created.id}`,
    );
  });

  it('does not nudge a guesser who has opted out (notify_enabled = false)', async () => {
    await db
      .update(users)
      .set({ notifyEnabled: false })
      .where(eq(users.id, friend.id));

    const res = await createTurnRoute(
      post('http://test/api/turns', {
        gameId,
        guesserId: friend.id,
        word: 'cat',
        strokes: someStrokes,
      }),
    );
    expect(res.status).toBe(201);
    expect(capture.sentNudges).toHaveLength(0);
  });

  it('still creates the turn (201) even if the nudge send fails', async () => {
    const boom = vi
      .spyOn(capture, 'sendNudge')
      .mockRejectedValueOnce(new Error('smtp down'));

    const res = await createTurnRoute(
      post('http://test/api/turns', {
        gameId,
        guesserId: friend.id,
        word: 'cat',
        strokes: someStrokes,
      }),
    );
    expect(res.status).toBe(201);
    const created = (await res.json()) as Turn;
    expect(created.status).toBe('awaiting_guess');
    expect(boom).toHaveBeenCalledOnce();
    boom.mockRestore();
  });
});
