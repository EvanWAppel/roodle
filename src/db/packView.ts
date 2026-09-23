/**
 * Read model for pack management UI (WORD-06): the packs a user can enable for
 * a game, each annotated with whether it is currently enabled. Combines the
 * built-in packs and the user's own custom packs. Enabled state follows the
 * game_packs semantics from packs.ts: no rows means all enabled.
 */
import { eq, or } from 'drizzle-orm';
import type { DB } from './client';
import { packs, gamePacks } from './schema';

export interface PackToggle {
  id: string;
  name: string;
  isBuiltin: boolean;
  enabled: boolean;
}

/**
 * Packs visible to `userId` for `gameId`: all built-in packs plus packs the
 * user owns, each with its enabled flag for the game. When the game has no
 * game_packs rows, everything reads enabled (the default).
 */
export async function listPacksForGame(
  db: DB,
  gameId: string,
  userId: string,
): Promise<PackToggle[]> {
  const visible = await db
    .select()
    .from(packs)
    .where(or(eq(packs.isBuiltin, true), eq(packs.ownerId, userId)));

  const gpRows = await db
    .select()
    .from(gamePacks)
    .where(eq(gamePacks.gameId, gameId));

  const enabledById = new Map(gpRows.map((r) => [r.packId, r.enabled]));

  return visible.map((p) => ({
    id: p.id,
    name: p.name,
    isBuiltin: p.isBuiltin,
    // Enabled by default; only an explicit enabled=false row disables a pack.
    enabled: enabledById.get(p.id) ?? true,
  }));
}
