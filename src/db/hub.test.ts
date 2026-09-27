// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createTestDb } from './testDb';
import { createFriendPair } from './friends';
import { createTurn } from './turns';
import { listGameCards } from './hub';

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
    expect(
      await listGameCards(db, '00000000-0000-0000-0000-000000000000'),
    ).toEqual([]);
  });
});
