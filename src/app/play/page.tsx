'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { DrawingReplay } from '@/components/DrawingReplay';
import { LetterTiles } from '@/components/LetterTiles';
import { buildTileTray } from '@/lib/guess';
import {
  fetchSession,
  fetchPending,
  submitGuess,
  giveUp,
  type SessionInfo,
  type TurnDTO,
} from '@/lib/api';
import { PlayerSwitch, type DevPlayer } from '@/components/PlayerSwitch';

export default function PlayPage() {
  const [as, setAs] = useState<DevPlayer>('christine');
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [pending, setPending] = useState<TurnDTO[]>([]);
  const [active, setActive] = useState<TurnDTO | null>(null);
  const [result, setResult] = useState<string>('');

  const refresh = useCallback(async (guesserId: string) => {
    setPending(await fetchPending(guesserId));
  }, []);

  useEffect(() => {
    fetchSession(as).then(async (s) => {
      setSession(s);
      setActive(null);
      setResult('');
      await refresh(s.me.id);
    });
  }, [as, refresh]);

  const tiles = useMemo(
    () => (active ? buildTileTray(active.word) : []),
    [active],
  );
  const blanks = useMemo(
    () => (active ? active.word.replace(/\s+/g, '').length : 0),
    [active],
  );

  const onComplete = useCallback(
    async (guess: string) => {
      if (!active || !session) return;
      const updated = await submitGuess(active.id, guess);
      if (updated.status === 'guessed') {
        setResult(`Correct! +${updated.pointsAwarded} point 🎉 (it was "${active.word}")`);
        setActive(null);
        await refresh(session.me.id);
      } else {
        setResult('Not quite — try again.');
      }
    },
    [active, session, refresh],
  );

  const onGiveUp = useCallback(async () => {
    if (!active || !session) return;
    const updated = await giveUp(active.id);
    setResult(`The word was "${updated.word}". No points this time.`);
    setActive(null);
    await refresh(session.me.id);
  }, [active, session, refresh]);

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Guess</h1>
        <nav className="flex gap-4 text-sm">
          <Link href="/draw" className="text-blue-600 underline">
            Draw →
          </Link>
          <Link href="/scores" className="text-blue-600 underline">
            Scores
          </Link>
        </nav>
      </div>

      <PlayerSwitch value={as} onChange={setAs} />
      {session && (
        <p className="text-sm text-gray-500">
          You are <strong>{session.me.displayName}</strong>.{' '}
          {pending.length} drawing(s) waiting.
        </p>
      )}

      {!active && (
        <ul className="flex flex-col gap-2">
          {pending.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                className="w-full rounded border px-3 py-2 text-left hover:bg-gray-50"
                onClick={() => {
                  setActive(t);
                  setResult('');
                }}
              >
                A drawing to guess ({t.word.replace(/\s+/g, '').length} letters)
              </button>
            </li>
          ))}
          {pending.length === 0 && (
            <li className="text-sm text-gray-400">Nothing to guess yet.</li>
          )}
        </ul>
      )}

      {active && (
        <div className="flex flex-col gap-3">
          <DrawingReplay drawing={active.strokes} />
          <LetterTiles
            key={active.id}
            tiles={tiles}
            length={blanks}
            onComplete={onComplete}
          />
          <button
            type="button"
            onClick={onGiveUp}
            className="self-start rounded border px-3 py-1 text-sm text-gray-600"
          >
            Give up / reveal
          </button>
        </div>
      )}

      {result && <p className="text-sm font-medium text-green-700">{result}</p>}
    </main>
  );
}
