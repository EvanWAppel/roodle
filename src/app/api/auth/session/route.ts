import { NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { getCurrentUser } from '@/auth/currentUser';
import { listFriendsWithGames } from '@/db/friends';

/**
 * GET /api/auth/session — the real-auth replacement for the old dev
 * /api/session stub. Returns the signed-in user and their friends (each with
 * the shared game id), or { me: null } when signed out.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ me: null, friends: [] });
  }

  const db = await getDb();
  const friends = await listFriendsWithGames(db, user.id);
  return NextResponse.json({
    me: { id: user.id, displayName: user.displayName },
    friends: friends.map((f) => ({
      opponent: { id: f.opponent.id, displayName: f.opponent.displayName },
      gameId: f.gameId,
    })),
  });
}
