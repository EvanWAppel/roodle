import { NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { getCurrentUser } from '@/auth/currentUser';
import {
  createCustomPack,
  listPacksForGame,
  isGameMember,
  MAX_PACK_NAME_LENGTH,
  MAX_PACK_WORDS,
  MAX_WORD_LENGTH,
  type CustomPackWord,
} from '@/db/packs';
import type { Difficulty } from '@/db/schema';

const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];

/** Normalize a word entry (string or {text,difficulty}) into a CustomPackWord. */
function toWord(entry: unknown): CustomPackWord | null {
  if (typeof entry === 'string') {
    const text = entry.trim();
    return text ? { text } : null;
  }
  if (entry && typeof entry === 'object' && 'text' in entry) {
    const e = entry as { text?: unknown; difficulty?: unknown };
    if (typeof e.text !== 'string' || !e.text.trim()) return null;
    const difficulty =
      typeof e.difficulty === 'string' &&
      DIFFICULTIES.includes(e.difficulty as Difficulty)
        ? (e.difficulty as Difficulty)
        : undefined;
    return { text: e.text.trim(), difficulty };
  }
  return null;
}

/**
 * POST /api/packs { name, words } — create a custom word pack owned by the
 * session user (WORD-04). `words` may be a string[] or {text,difficulty}[].
 * Empty/invalid payloads are rejected with 400.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    name?: unknown;
    words?: unknown;
  } | null;

  if (!body || typeof body.name !== 'string' || !body.name.trim()) {
    return NextResponse.json({ error: 'missing pack name' }, { status: 400 });
  }
  if (body.name.length > MAX_PACK_NAME_LENGTH) {
    return NextResponse.json(
      { error: `pack name too long (max ${MAX_PACK_NAME_LENGTH})` },
      { status: 400 },
    );
  }
  if (!Array.isArray(body.words)) {
    return NextResponse.json({ error: 'missing word list' }, { status: 400 });
  }
  // Bound the payload before parsing/inserting so one request can't balloon
  // storage (DoS/abuse guard, mirroring DRAW-06's size budget).
  if (body.words.length > MAX_PACK_WORDS) {
    return NextResponse.json(
      { error: `too many words (max ${MAX_PACK_WORDS})` },
      { status: 400 },
    );
  }

  const parsed = body.words.map(toWord).filter((w): w is CustomPackWord => w !== null);
  if (parsed.length === 0) {
    return NextResponse.json(
      { error: 'word list must contain at least one word' },
      { status: 400 },
    );
  }
  if (parsed.some((w) => w.text.length > MAX_WORD_LENGTH)) {
    return NextResponse.json(
      { error: `word too long (max ${MAX_WORD_LENGTH})` },
      { status: 400 },
    );
  }

  const db = await getDb();
  const pack = await createCustomPack(db, {
    ownerId: user.id,
    name: body.name,
    words: parsed,
  });
  return NextResponse.json(pack, { status: 201 });
}

/**
 * GET /api/packs?gameId=<id> — list every pack with its enabled flag for the
 * given game (WORD-06). The caller must be a player in that game.
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  const gameId = new URL(req.url).searchParams.get('gameId');
  if (!gameId) {
    return NextResponse.json({ error: 'missing gameId' }, { status: 400 });
  }

  const db = await getDb();
  if (!(await isGameMember(db, gameId, user.id))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const list = await listPacksForGame(db, gameId, user.id);
  return NextResponse.json(list);
}
