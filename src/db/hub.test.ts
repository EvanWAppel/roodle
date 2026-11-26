// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createTestDb } from './testDb';
import { createFriendPair } from './friends';
import { createTurn } from './turns';
import { listGameCards } from './hub';
import { turns } from './schema';

describe('private game hub', () => {
  it('keeps incoming and outgoing activity separate for each friend', async () => {
    const db = await createTestDb();
    const first = await createFriendPair(db, {
      emailA: 'me@example.com',
      displayA: 'Me',
      emailB: 'christine@example.com',
      displayB: 'Christine',
    });
    const second = await createFriendPair(db, {
      emailA: 'me@example.com',
      displayA: 'Me',
      emailB: 'tester@example.com',
      displayB: 'Tester',
    });
    const incoming = await createTurn(db, {
      gameId: first.game.id,
      drawerId: first.userB.id,
      guesserId: first.userA.id,
      word: 'cat',
      strokes: [],
    });
    await createTurn(db, {
      gameId: second.game.id,
      drawerId: second.userA.id,
      guesserId: second.userB.id,
      word: 'dog',
      strokes: [],
    });
    const cards = await listGameCards(db, first.userA.id);
    expect(cards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          gameId: first.game.id,
          name: 'Christine',
          incoming: 1,
          waiting: 0,
          turnId: incoming.id,
        }),
        expect.objectContaining({
          gameId: second.game.id,
          name: 'Tester',
          incoming: 0,
          waiting: 1,
          turnId: null,
        }),
      ]),
    );
    expect(JSON.stringify(cards)).not.toContain('"word"');
    const christine = cards.find((c) => c.gameId === first.game.id)!;
    expect(christine.incomingSince).toEqual(incoming.createdAt);
    expect(christine.waitingSince).toBeNull();
    const tester = cards.find((c) => c.gameId === second.game.id)!;
    expect(tester.incomingSince).toBeNull();
    expect(tester.waitingSince).toBeInstanceOf(Date);
    expect(
      await listGameCards(db, '00000000-0000-0000-0000-000000000000'),
    ).toEqual([]);
  });

  it('reports the oldest pending createdAt on each side', async () => {
    const db = await createTestDb();
    const pair = await createFriendPair(db, {
      emailA: 'me@example.com',
      displayA: 'Me',
      emailB: 'christine@example.com',
      displayB: 'Christine',
    });
    const turn = (drawerId: string, guesserId: string, at: string) =>
      db
        .insert(turns)
        .values({
          gameId: pair.game.id,
          drawerId,
          guesserId,
          word: 'cat',
          strokes: [],
          createdAt: new Date(at),
        })
        .returning()
        .then(([t]) => t);
    await turn(pair.userB.id, pair.userA.id, '2026-11-21T10:00:00Z');
    const oldestIn = await turn(
      pair.userB.id,
      pair.userA.id,
      '2026-11-21T09:00:00Z',
    );
    await turn(pair.userA.id, pair.userB.id, '2026-11-20T12:00:00Z');
    await turn(pair.userA.id, pair.userB.id, '2026-11-20T08:00:00Z');
    const [card] = await listGameCards(db, pair.userA.id);
    expect(card).toMatchObject({
      incoming: 2,
      waiting: 2,
      turnId: oldestIn.id,
      incomingSince: new Date('2026-11-21T09:00:00Z'),
      waitingSince: new Date('2026-11-20T08:00:00Z'),
    });
  });
});
