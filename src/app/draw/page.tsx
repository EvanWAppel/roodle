'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DrawCanvas } from '@/components/DrawCanvas';
import { pickRandomWord } from '@/lib/words';
import {
  fetchAuthSession,
  submitTurn,
  type Person,
  type FriendInfo,
} from '@/lib/api';
import type { Drawing } from '@/lib/strokes';

/**
 * Ask the server for a word from the game's enabled packs (WORD-03). Falls back
 * to the built-in hardcoded list if the offer is empty or the request fails, so
 * the draw flow always has a word.
 */
async function offerWord(gameId: string, exclude?: string): Promise<string> {
  try {
    const qs = new URLSearchParams({ gameId });
    if (exclude) qs.set('exclude', exclude);
    const res = await fetch(`/api/packs/word?${qs.toString()}`);
    if (res.ok) {
      const data = (await res.json()) as { word: { text: string } | null };
      if (data.word) return data.word.text;
    }
  } catch {
    // fall through to the local list
  }
  return pickRandomWord(undefined, exclude);
}

export default function DrawPage() {
  const router = useRouter();
  const [me, setMe] = useState<Person | null>(null);
  const [friends, setFriends] = useState<FriendInfo[]>([]);
  const [friendIndex, setFriendIndex] = useState(0);
  const [word, setWord] = useState('');
  const [drawing, setDrawing] = useState<Drawing>([]);
  const [busy, setBusy] = useState(false);
  const [canvasVersion, setCanvasVersion] = useState(0);
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    fetchAuthSession().then((s) => {
      if (!s.me) {
        router.replace('/signin');
        return;
      }
      setMe(s.me);
      setFriends(s.friends);
      const gameId = new URLSearchParams(window.location.search).get('game');
      const selected = s.friends.findIndex(
        (friend) => friend.gameId === gameId,
      );
      setFriendIndex(selected >= 0 ? selected : 0);
    });
  }, [router]);

  const opponent = friends[friendIndex];

  // Offer a word from the selected game's enabled packs once we know the
  // opponent. Runs on the client (after mount) to avoid an SSR hydration
  // mismatch from Math.random, and re-offers when switching opponents.
  useEffect(() => {
    if (!opponent) return;
    let active = true;
    offerWord(opponent.gameId).then((w) => {
      if (active) setWord(w);
    });
    return () => {
      active = false;
    };
  }, [opponent]);

  const canSubmit = useMemo(
    () => Boolean(me && opponent && word && drawing.length > 0 && !busy),
    [me, opponent, word, drawing, busy],
  );

  const submit = useCallback(async () => {
    if (!canSubmit || !me || !opponent) return;
    setBusy(true);
    setStatus('Submitting…');
    try {
      await submitTurn({
        gameId: opponent.gameId,
        guesserId: opponent.opponent.id,
        word,
        strokes: drawing,
      });
      setStatus(
        `Sent to ${opponent.opponent.displayName}! Pick a new word to draw again.`,
      );
      setDrawing([]);
      setCanvasVersion((version) => version + 1);
      setWord(await offerWord(opponent.gameId, word));
    } catch {
      setStatus('Could not send your drawing. Please try again.');
    } finally {
      setBusy(false);
    }
  }, [me, opponent, word, drawing, canSubmit]);

  const newWord = useCallback(async () => {
    if (!opponent || busy) return;
    setBusy(true);
    setDrawing([]);
    setCanvasVersion((version) => version + 1);
    setWord(await offerWord(opponent.gameId, word));
    setBusy(false);
  }, [opponent, word, busy]);

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Draw</h1>
        <nav className="flex flex-wrap gap-4 text-sm">
          <Link href="/friends" className="text-blue-600 underline">
            Invite a friend
          </Link>
          <Link href="/play" className="text-blue-600 underline">
            Guess →
          </Link>
          <Link href="/packs" className="text-blue-600 underline">
            Packs
          </Link>
          <Link href="/scores" className="text-blue-600 underline">
            Scores
          </Link>
        </nav>
      </div>

      {me && friends.length === 0 && (
        <p className="text-sm text-gray-500">
          You have no friends yet. Invite a friend to start playing.
        </p>
      )}

      {me && friends.length > 1 && (
        <label className="flex items-center gap-2 text-sm">
          <span className="text-gray-500">Draw for:</span>
          <select
            value={friendIndex}
            disabled={busy}
            onChange={(e) => {
              setFriendIndex(Number(e.target.value));
              setWord('');
              setDrawing([]);
              setStatus('');
            }}
            className="rounded border px-2 py-1"
          >
            {friends.map((f, i) => (
              <option key={f.opponent.id} value={i}>
                {f.opponent.displayName}
              </option>
            ))}
          </select>
        </label>
      )}

      {me && opponent && (
        <p className="text-sm text-gray-500">
          You are <strong>{me.displayName}</strong>, drawing for{' '}
          <strong>{opponent.opponent.displayName}</strong>.
        </p>
      )}

      {opponent && (
        <>
          <div className="flex items-center gap-3">
            <span className="text-lg">
              Draw: <strong className="tracking-wide">{word || '…'}</strong>
            </span>
            <button
              type="button"
              className="rounded border px-2 py-1 text-sm"
              onClick={newWord}
              disabled={busy || !word}
            >
              New word
            </button>
          </div>

          <DrawCanvas
            key={`${opponent.gameId}:${canvasVersion}`}
            onChange={setDrawing}
          />

          <button
            type="button"
            disabled={!canSubmit}
            onClick={submit}
            className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-40"
          >
            Submit drawing
          </button>
        </>
      )}

      {status && <p className="text-sm text-green-700">{status}</p>}
    </main>
  );
}
