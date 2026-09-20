import { eq } from 'drizzle-orm';
import type { DB } from './client';
import { users, games, type User, type Game } from './schema';

/**
 * SLICE-03: the two fixed dev players. Real identity (magic-link) arrives with
 * the AUTH group, which will replace this seed-based stub.
 */
export const DEV_PLAYERS = [
  { email: 'evan@roodle.local', displayName: 'Evan' },
  { email: 'christine@roodle.local', displayName: 'Christine' },
] as const;

async function ensureUser(
  db: DB,
  email: string,
  displayName: string,
): Promise<User> {
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing[0]) return existing[0];
  const [created] = await db
    .insert(users)
    .values({ email, displayName })
    .returning();
  return created;
}

/**
 * Idempotently ensure the two dev players and a single game between them exist.
 * Returns them so the app/tests can address turns. Safe to call repeatedly.
 */
export async function ensureSeed(
  db: DB,
): Promise<{ playerA: User; playerB: User; game: Game }> {
  const playerA = await ensureUser(
    db,
    DEV_PLAYERS[0].email,
    DEV_PLAYERS[0].displayName,
  );
  const playerB = await ensureUser(
    db,
    DEV_PLAYERS[1].email,
    DEV_PLAYERS[1].displayName,
  );

  const existingGame = await db
    .select()
    .from(games)
    .where(eq(games.playerA, playerA.id))
    .limit(1);
  const game =
    existingGame[0] ??
    (
      await db
        .insert(games)
        .values({ playerA: playerA.id, playerB: playerB.id })
        .returning()
    )[0];

  return { playerA, playerB, game };
}
