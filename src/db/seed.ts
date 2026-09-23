import type { DB } from './client';
import { createFriendPair } from './friends';
import type { User, Game, Friendship } from './schema';

/**
 * Dev-only convenience: seed Evan + Christine as friends with a game so the app
 * is playable locally without doing the full email invite round-trip. This is
 * NOT how the app establishes identity — the pages rely on real sessions and
 * real friendships. Guarded to never run in production.
 */
export const DEV_FRIENDS = {
  emailA: 'evan@roodle.local',
  emailB: 'christine@roodle.local',
  displayA: 'Evan',
  displayB: 'Christine',
} as const;

export async function seedDevFriends(
  db: DB,
): Promise<{ userA: User; userB: User; friendship: Friendship; game: Game }> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('seedDevFriends must not run in production');
  }
  return createFriendPair(db, DEV_FRIENDS);
}
