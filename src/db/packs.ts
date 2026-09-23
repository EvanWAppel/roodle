/**
 * Word-pack data access (WORD group). A pack is a named collection of words;
 * built-in packs are curated and ownerless, custom packs are owned by a user.
 * Word selection for a game honors which packs are enabled and the chosen
 * difficulty. Errors are surfaced, never swallowed.
 */
import { and, eq } from 'drizzle-orm';
import type { DB } from './client';
import {
  packs,
  words,
  gamePacks,
  type Pack,
  type Word,
  type Difficulty,
} from './schema';

/** A word to seed/create, with its difficulty. */
export interface WordInput {
  text: string;
  difficulty: Difficulty;
}

/** Raised when a pack has no usable words (empty or all blank). */
export class EmptyPackError extends Error {
  constructor() {
    super('a pack must contain at least one word');
    this.name = 'EmptyPackError';
  }
}

/**
 * Create a pack and its words in one call. `ownerId` null + isBuiltin true is a
 * curated pack; a real ownerId + isBuiltin false is a user's custom pack.
 * Throws EmptyPackError if no non-blank words are supplied.
 */
export async function createPack(
  db: DB,
  input: {
    name: string;
    ownerId: string | null;
    isBuiltin: boolean;
    words: WordInput[];
  },
): Promise<{ pack: Pack; words: Word[] }> {
  const name = input.name.trim();
  if (!name) throw new Error('pack name is required');

  // Normalize + drop blanks; a pack with nothing to draw is useless.
  const cleaned = input.words
    .map((w) => ({ text: w.text.trim(), difficulty: w.difficulty }))
    .filter((w) => w.text.length > 0);
  if (cleaned.length === 0) throw new EmptyPackError();

  const [pack] = await db
    .insert(packs)
    .values({ name, ownerId: input.ownerId, isBuiltin: input.isBuiltin })
    .returning();

  const inserted = await db
    .insert(words)
    .values(cleaned.map((w) => ({ packId: pack.id, ...w })))
    .returning();

  return { pack, words: inserted };
}

/** All words belonging to a pack. */
export async function wordsInPack(db: DB, packId: string): Promise<Word[]> {
  return db.select().from(words).where(eq(words.packId, packId));
}

/**
 * The pack ids explicitly disabled for a game (WORD-05). A pack is enabled by
 * default; it is offered unless there is a game_packs row with enabled=false.
 * This "disabled set" model means toggling one pack off leaves the rest on
 * (rather than an enabled-allowlist, where the first toggle would hide
 * everything unlisted). An empty set means every pack is enabled.
 */
export async function disabledPackIdsForGame(
  db: DB,
  gameId: string,
): Promise<Set<string>> {
  const rows = await db
    .select()
    .from(gamePacks)
    .where(eq(gamePacks.gameId, gameId));
  return new Set(rows.filter((r) => !r.enabled).map((r) => r.packId));
}

/** Enable or disable a pack for a game (upsert on the game+pack pair). */
export async function setPackEnabled(
  db: DB,
  gameId: string,
  packId: string,
  enabled: boolean,
): Promise<void> {
  const [existing] = await db
    .select()
    .from(gamePacks)
    .where(and(eq(gamePacks.gameId, gameId), eq(gamePacks.packId, packId)))
    .limit(1);
  if (existing) {
    await db
      .update(gamePacks)
      .set({ enabled })
      .where(eq(gamePacks.id, existing.id));
    return;
  }
  await db.insert(gamePacks).values({ gameId, packId, enabled });
}

/**
 * Words offered for a game at a difficulty (WORD-03/05): words from packs that
 * are not disabled for the game, at the given difficulty. A pack is enabled by
 * default (see disabledPackIdsForGame). Returns the plain word strings, deduped
 * and sorted for deterministic output.
 */
export async function candidateWordsForGame(
  db: DB,
  gameId: string,
  difficulty: Difficulty,
): Promise<string[]> {
  const disabled = await disabledPackIdsForGame(db, gameId);
  const rows = await db
    .select()
    .from(words)
    .where(eq(words.difficulty, difficulty));

  const uniq = Array.from(
    new Set(rows.filter((r) => !disabled.has(r.packId)).map((r) => r.text)),
  );
  uniq.sort();
  return uniq;
}

/**
 * Pick a random word for a game at a difficulty, honoring enabled packs. Never
 * returns `exclude` when given (unless it is the only candidate). Returns null
 * when no word is available so callers can decide how to surface that, rather
 * than throwing inside the draw loop.
 */
export async function pickWordForGame(
  db: DB,
  gameId: string,
  difficulty: Difficulty,
  opts: { exclude?: string; rng?: () => number } = {},
): Promise<string | null> {
  const rng = opts.rng ?? Math.random;
  const all = await candidateWordsForGame(db, gameId, difficulty);
  if (all.length === 0) return null;
  const pool =
    opts.exclude && all.length > 1
      ? all.filter((w) => w !== opts.exclude)
      : all;
  return pool[Math.floor(rng() * pool.length)];
}
