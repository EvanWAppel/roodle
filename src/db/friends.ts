/**
 * Friendship + game data access. A friendship is symmetric and stored once per
 * pair in canonical order (userAId < userBId as strings). A pair shares one
 * game. Errors are never swallowed.
 */
import { and, eq, or } from 'drizzle-orm';
import type { DB } from './client';
import {
  users,
  games,
  friendships,
  type User,
  type Friendship,
  type Game,
} from './schema';
import { normalizeEmail } from '@/auth/service';

/** Order a pair of user ids canonically (lexicographically ascending). */
export function canonicalPair(x: string, y: string): [string, string] {
  return x < y ? [x, y] : [y, x];
}

/** Are these two users friends? Order-independent. */
export async function areFriends(
  db: DB,
  x: string,
  y: string,
): Promise<boolean> {
  const [a, b] = canonicalPair(x, y);
  const [row] = await db
    .select({ id: friendships.id })
    .from(friendships)
    .where(and(eq(friendships.userAId, a), eq(friendships.userBId, b)))
    .limit(1);
  return Boolean(row);
}

/** Create the friendship for a pair if absent; return the (existing or new) row. */
export async function ensureFriendship(
  db: DB,
  x: string,
  y: string,
): Promise<Friendship> {
  const [a, b] = canonicalPair(x, y);
  const [existing] = await db
    .select()
    .from(friendships)
    .where(and(eq(friendships.userAId, a), eq(friendships.userBId, b)))
    .limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(friendships)
    .values({ userAId: a, userBId: b })
    .returning();
  return created;
}

/** The single game shared by a pair, or undefined. Order-independent. */
export async function findGameForPair(
  db: DB,
  x: string,
  y: string,
): Promise<Game | undefined> {
  const [a, b] = canonicalPair(x, y);
  const [game] = await db
    .select()
    .from(games)
    .where(
      or(
        and(eq(games.playerA, a), eq(games.playerB, b)),
        and(eq(games.playerA, b), eq(games.playerB, a)),
      ),
    )
    .limit(1);
  return game;
}

/** Create the pair's game if none exists; return the (existing or new) game. */
export async function ensureGameForPair(
  db: DB,
  x: string,
  y: string,
): Promise<Game> {
  const existing = await findGameForPair(db, x, y);
  if (existing) return existing;
  const [a, b] = canonicalPair(x, y);
  const [created] = await db
    .insert(games)
    .values({ playerA: a, playerB: b })
    .returning();
  return created;
}

export interface FriendWithGame {
  opponent: User;
  gameId: string;
}

/**
 * Every accepted friend of a user, paired with the game they share. A friend
 * without a game yet is omitted (there is always a game after acceptInvite, but
 * be defensive rather than invent one here).
 */
export async function listFriendsWithGames(
  db: DB,
  userId: string,
): Promise<FriendWithGame[]> {
  const rows = await db
    .select()
    .from(friendships)
    .where(
      or(eq(friendships.userAId, userId), eq(friendships.userBId, userId)),
    );

  const out: FriendWithGame[] = [];
  for (const f of rows) {
    const otherId = f.userAId === userId ? f.userBId : f.userAId;
    const [opponent] = await db
      .select()
      .from(users)
      .where(eq(users.id, otherId))
      .limit(1);
    if (!opponent) continue;
    const game = await findGameForPair(db, userId, otherId);
    if (!game) continue;
    out.push({ opponent, gameId: game.id });
  }
  return out;
}

async function ensureUser(
  db: DB,
  email: string,
  displayName: string,
): Promise<User> {
  const normalized = normalizeEmail(email);
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, normalized))
    .limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(users)
    .values({ email: normalized, displayName })
    .returning();
  return created;
}

/**
 * Test/dev helper: two real users, their friendship (canonical), and their
 * game. Replaces the old DEV_PLAYERS seed for tests. Idempotent per email.
 */
export async function createFriendPair(
  db: DB,
  opts: { emailA: string; emailB: string; displayA: string; displayB: string },
): Promise<{ userA: User; userB: User; friendship: Friendship; game: Game }> {
  const userA = await ensureUser(db, opts.emailA, opts.displayA);
  const userB = await ensureUser(db, opts.emailB, opts.displayB);
  const friendship = await ensureFriendship(db, userA.id, userB.id);
  const game = await ensureGameForPair(db, userA.id, userB.id);
  return { userA, userB, friendship, game };
}
