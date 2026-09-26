/**
 * Data access for word packs (WORD-03/04/05): create custom packs, toggle a
 * pack's enablement per game, list packs with their per-game enabled flag, and
 * select a random word for a game honoring enabled packs + difficulty.
 *
 * Difficulty is METADATA ONLY and never affects scoring (DECISIONS.md D5).
 * Errors are never swallowed.
 */
import { and, eq, inArray } from 'drizzle-orm';
import type { DB } from './client';
import {
  packs,
  words,
  gamePacks,
  games,
  type Pack,
  type Word,
  type Difficulty,
} from './schema';
import { pickRandomWord } from '@/lib/words';

/** Is this user one of the two players in the given game? Order-independent. */
export async function isGameMember(
  db: DB,
  gameId: string,
  userId: string,
): Promise<boolean> {
  const [game] = await db
    .select({ playerA: games.playerA, playerB: games.playerB })
    .from(games)
    .where(eq(games.id, gameId))
    .limit(1);
  if (!game) return false;
  return game.playerA === userId || game.playerB === userId;
}

export interface CustomPackWord {
  text: string;
  difficulty?: Difficulty;
}
export interface CreateCustomPackInput {
  ownerId: string;
  name: string;
  words: CustomPackWord[];
}

/** Create a user-owned custom pack with its words. Validates name + word list. */
export async function createCustomPack(
  db: DB,
  input: CreateCustomPackInput,
): Promise<Pack> {
  const name = input.name?.trim();
  if (!name) {
    throw new Error('createCustomPack: name must be a non-empty string');
  }
  const cleaned = (input.words ?? [])
    .map((wrd) => ({
      text: wrd.text?.trim(),
      difficulty: wrd.difficulty ?? ('easy' as Difficulty),
    }))
    .filter((wrd) => Boolean(wrd.text));
  if (cleaned.length === 0) {
    throw new Error('createCustomPack: word list must be non-empty');
  }

  const [pack] = await db
    .insert(packs)
    .values({ name, ownerId: input.ownerId, isBuiltin: false })
    .returning();

  await db.insert(words).values(
    cleaned.map((wrd) => ({
      packId: pack.id,
      text: wrd.text as string,
      difficulty: wrd.difficulty,
    })),
  );

  return pack;
}

/**
 * Enable (row present) or disable (row absent) a pack for a game. Presence of a
 * game_packs row is the source of truth for "enabled" (see schema). Idempotent.
 */
export async function setPackEnabled(
  db: DB,
  gameId: string,
  packId: string,
  enabled: boolean,
): Promise<void> {
  if (enabled) {
    const [existing] = await db
      .select({ id: gamePacks.id })
      .from(gamePacks)
      .where(and(eq(gamePacks.gameId, gameId), eq(gamePacks.packId, packId)))
      .limit(1);
    if (!existing) {
      await db.insert(gamePacks).values({ gameId, packId });
    }
    return;
  }
  await db
    .delete(gamePacks)
    .where(and(eq(gamePacks.gameId, gameId), eq(gamePacks.packId, packId)));
}

/** The pack ids currently enabled for a game. */
export async function enabledPackIdsForGame(
  db: DB,
  gameId: string,
): Promise<string[]> {
  const rows = await db
    .select({ packId: gamePacks.packId })
    .from(gamePacks)
    .where(eq(gamePacks.gameId, gameId));
  return rows.map((r) => r.packId);
}

export interface PackWithEnabled extends Pack {
  enabled: boolean;
}

/** Every pack (built-in + this game's custom packs), each flagged enabled. */
export async function listPacksForGame(
  db: DB,
  gameId: string,
): Promise<PackWithEnabled[]> {
  const all = await db.select().from(packs);
  const enabled = new Set(await enabledPackIdsForGame(db, gameId));
  return all.map((p) => ({ ...p, enabled: enabled.has(p.id) }));
}

export interface SelectWordOptions {
  gameId: string;
  difficulty?: Difficulty;
  /** Avoid re-offering the same word back to back. */
  exclude?: string;
  rng?: () => number;
}

/**
 * Pick a random word for a game. Only words from packs enabled for the game are
 * eligible; if none are enabled we fall back to ALL built-in packs so the draw
 * flow always has words (a freshly-created game hasn't picked packs yet). When
 * a difficulty is given, only words at that difficulty are eligible. Returns
 * null if no word matches (e.g. difficulty with no words in the enabled set).
 */
export async function selectWordForGame(
  db: DB,
  opts: SelectWordOptions,
): Promise<Word | null> {
  const enabledIds = await enabledPackIdsForGame(db, opts.gameId);

  let packIds = enabledIds;
  if (packIds.length === 0) {
    const builtin = await db
      .select({ id: packs.id })
      .from(packs)
      .where(eq(packs.isBuiltin, true));
    packIds = builtin.map((p) => p.id);
  }
  if (packIds.length === 0) return null;

  const conditions = [inArray(words.packId, packIds)];
  if (opts.difficulty) {
    conditions.push(eq(words.difficulty, opts.difficulty));
  }
  const candidates = await db
    .select()
    .from(words)
    .where(and(...conditions));

  if (candidates.length === 0) return null;

  const texts = candidates.map((c) => c.text);
  const chosenText = pickRandomWord(texts, opts.exclude, opts.rng);
  // pickRandomWord returns a text; map back to the full Word row (first match).
  return candidates.find((c) => c.text === chosenText) ?? candidates[0];
}
