// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '@/db/testDb';
import { createFriendPair } from '@/db/friends';
import { createTurn } from '@/db/turns';
import { users } from '@/db/schema';
import type { DB } from '@/db/client';
import type { Turn, User } from '@/db/schema';
import { CaptureTransport, type EmailTransport } from '@/auth/email';
import { nudgeGuesser, turnDeepLink } from './nudge';

const someStrokes = [
  { color: '#111827', width: 4, points: [{ x: 0, y: 0 }, { x: 10, y: 10 }] },
];

describe('turnDeepLink (NOTIF-04)', () => {
  it('opens the specific pending turn on the play page', () => {
    expect(turnDeepLink('https://roodle.app', 'turn-123')).toBe(
      'https://roodle.app/play?turn=turn-123',
    );
  });
});

describe('nudgeGuesser', () => {
  let db: DB;
  let drawer: User;
  let guesser: User;
  let turn: Turn;

  beforeEach(async () => {
    db = await createTestDb();
    const pair = await createFriendPair(db, {
      emailA: 'drawer@example.com',
      emailB: 'guesser@example.com',
      displayA: 'Drawer',
      displayB: 'Guesser',
    });
    drawer = pair.userA;
    guesser = pair.userB;
    turn = await createTurn(db, {
      gameId: pair.game.id,
      drawerId: drawer.id,
      guesserId: guesser.id,
      word: 'cat',
      strokes: someStrokes,
    });
  });

  it('sends exactly one nudge to the guesser with a deep link to the turn (NOTIF-03/04)', async () => {
    const capture = new CaptureTransport();
    const sent = await nudgeGuesser(db, turn, 'https://roodle.app', capture);

    expect(sent).toBe(true);
    expect(capture.sentNudges).toHaveLength(1);
    expect(capture.sentNudges[0].to).toBe('guesser@example.com');
    expect(capture.sentNudges[0].url).toBe(
      `https://roodle.app/play?turn=${turn.id}`,
    );
  });

  it('sends no email when the guesser has opted out (NOTIF-05)', async () => {
    await db
      .update(users)
      .set({ notifyEnabled: false })
      .where(eq(users.id, guesser.id));

    const capture = new CaptureTransport();
    const sent = await nudgeGuesser(db, turn, 'https://roodle.app', capture);

    expect(sent).toBe(false);
    expect(capture.sentNudges).toHaveLength(0);
  });

  it('propagates a transport send failure (no silent swallow, NOTIF-02)', async () => {
    const failing: EmailTransport = {
      sendMagicLink: async () => {},
      sendInvite: async () => {},
      sendNudge: async (): Promise<void> => {
        throw new Error('smtp down');
      },
    };
    await expect(
      nudgeGuesser(db, turn, 'https://roodle.app', failing),
    ).rejects.toThrow(/smtp down/);
  });

  it('throws when the guesser does not exist', async () => {
    const orphanTurn = { ...turn, guesserId: '00000000-0000-0000-0000-000000000000' };
    const capture = new CaptureTransport();
    await expect(
      nudgeGuesser(db, orphanTurn, 'https://roodle.app', capture),
    ).rejects.toThrow(/guesser not found/);
  });
});
