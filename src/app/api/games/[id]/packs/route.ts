import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { getCurrentUser } from '@/auth/currentUser';
import { games } from '@/db/schema';
import { listPacksForGame } from '@/db/packView';
import { setPackEnabled } from '@/db/packs';

/** Confirm the signed-in user participates in the game; return it or null. */
async function requireParticipant(gameId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: 'unauthenticated' as const, status: 401 };
  const db = await getDb();
  const [game] = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
  if (!game) return { error: 'unknown game' as const, status: 404 };
  if (game.playerA !== user.id && game.playerB !== user.id) {
    return { error: 'forbidden' as const, status: 403 };
  }
  return { user, game, db };
}

/**
 * GET /api/games/[id]/packs — list the packs available for a game with their
 * enabled flags (WORD-06). Built-in packs plus the caller's own custom packs.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await requireParticipant(id);
  if ('error' in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  const list = await listPacksForGame(ctx.db, id, ctx.user.id);
  return NextResponse.json({ packs: list });
}

/**
 * PATCH /api/games/[id]/packs { packId, enabled } — enable/disable a pack for a
 * game (WORD-05/06).
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await requireParticipant(id);
  if ('error' in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  const body = (await req.json().catch(() => null)) as {
    packId?: unknown;
    enabled?: unknown;
  } | null;
  if (
    !body ||
    typeof body.packId !== 'string' ||
    typeof body.enabled !== 'boolean'
  ) {
    return NextResponse.json(
      { error: 'packId and enabled are required' },
      { status: 400 },
    );
  }
  await setPackEnabled(ctx.db, id, body.packId, body.enabled);
  return NextResponse.json({ ok: true });
}
