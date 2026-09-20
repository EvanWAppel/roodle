// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { createTestDb } from './testDb';
import { ensureSeed, DEV_PLAYERS } from './seed';

describe('ensureSeed (SLICE-03)', () => {
  it('creates the two dev players and a game between them', async () => {
    const db = await createTestDb();
    const { playerA, playerB, game } = await ensureSeed(db);
    expect(playerA.displayName).toBe(DEV_PLAYERS[0].displayName);
    expect(playerB.displayName).toBe(DEV_PLAYERS[1].displayName);
    expect(game.playerA).toBe(playerA.id);
    expect(game.playerB).toBe(playerB.id);
  });

  it('is idempotent — repeated calls reuse the same rows', async () => {
    const db = await createTestDb();
    const first = await ensureSeed(db);
    const second = await ensureSeed(db);
    expect(second.playerA.id).toBe(first.playerA.id);
    expect(second.playerB.id).toBe(first.playerB.id);
    expect(second.game.id).toBe(first.game.id);
  });
});
