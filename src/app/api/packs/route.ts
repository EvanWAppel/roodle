import { NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { getCurrentUser } from '@/auth/currentUser';
import { createPack, EmptyPackError, type WordInput } from '@/db/packs';
import type { Difficulty } from '@/db/schema';

const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];

function isDifficulty(x: unknown): x is Difficulty {
  return typeof x === 'string' && (DIFFICULTIES as readonly string[]).includes(x);
}

interface WordPayload {
  text?: unknown;
  difficulty?: unknown;
}

/**
 * POST /api/packs — create a custom word pack owned by the signed-in user
 * (WORD-04). Body: { name, words: [{ text, difficulty }] }. Words default to
 * 'medium' difficulty if omitted. 401 unauthenticated, 400 for an invalid or
 * empty pack.
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
    return NextResponse.json({ error: 'a pack name is required' }, { status: 400 });
  }
  if (!Array.isArray(body.words)) {
    return NextResponse.json({ error: 'words must be a list' }, { status: 400 });
  }

  const wordInputs: WordInput[] = [];
  for (const raw of body.words as WordPayload[]) {
    if (!raw || typeof raw.text !== 'string') {
      return NextResponse.json(
        { error: 'each word needs text' },
        { status: 400 },
      );
    }
    if (raw.difficulty !== undefined && !isDifficulty(raw.difficulty)) {
      return NextResponse.json(
        { error: 'difficulty must be easy, medium, or hard' },
        { status: 400 },
      );
    }
    wordInputs.push({
      text: raw.text,
      difficulty: isDifficulty(raw.difficulty) ? raw.difficulty : 'medium',
    });
  }

  const db = await getDb();
  let packId: string;
  try {
    const { pack } = await createPack(db, {
      name: body.name,
      ownerId: user.id,
      isBuiltin: false,
      words: wordInputs,
    });
    packId = pack.id;
  } catch (e) {
    if (e instanceof EmptyPackError) {
      return NextResponse.json(
        { error: 'a pack must contain at least one word' },
        { status: 400 },
      );
    }
    throw e; // never hide unexpected failures
  }

  return NextResponse.json({ ok: true, packId }, { status: 201 });
}
