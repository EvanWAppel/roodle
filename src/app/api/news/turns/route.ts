import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { listGameCards } from '@/db/hub';
import { users } from '@/db/schema';
import { normalizeEmail } from '@/auth/service';
import { bearerMatches, isoSeconds, newsEntries } from '@/news/turns';

/**
 * GET /api/news/turns — where the news player (NEWS_PLAYER_EMAIL) stands with
 * each friend, for ложь's build (X8, schema 1). Bearer ROODLE_READ_TOKEN only;
 * the player never comes from the request. Logs counts, never names.
 */
export async function GET(req: Request) {
  if (
    !bearerMatches(
      req.headers.get('authorization'),
      process.env.ROODLE_READ_TOKEN,
    )
  ) {
    console.warn('[roodle] news/turns: rejected unauthorized request');
    return new Response(null, { status: 401 });
  }

  const email = process.env.NEWS_PLAYER_EMAIL?.trim();
  if (!email) throw new Error('NEWS_PLAYER_EMAIL is not set');

  const db = await getDb();
  const [player] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, normalizeEmail(email)))
    .limit(1);
  const games = player ? newsEntries(await listGameCards(db, player.id)) : [];
  console.info(
    `[roodle] news/turns: ${games.length} games (${games.filter((g) => g.turn === 'you').length} on you)${player ? '' : ' — news player has no account'}`,
  );
  return NextResponse.json({
    schema: 1,
    game: 'roodle',
    generated_at: isoSeconds(new Date()),
    games,
  });
}

function methodNotAllowed() {
  return new Response(null, { status: 405, headers: { allow: 'GET' } });
}

export {
  methodNotAllowed as POST,
  methodNotAllowed as PUT,
  methodNotAllowed as PATCH,
  methodNotAllowed as DELETE,
};
