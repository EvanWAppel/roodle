'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { DrawCanvas } from '@/components/DrawCanvas';
import { pickRandomWord } from '@/lib/words';
import { fetchSession, submitTurn, type SessionInfo } from '@/lib/api';
import type { Drawing } from '@/lib/strokes';
import { PlayerSwitch, type DevPlayer } from '@/components/PlayerSwitch';

export default function DrawPage() {
  const [as, setAs] = useState<DevPlayer>('evan');
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [word, setWord] = useState('');
  const [drawing, setDrawing] = useState<Drawing>([]);
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    fetchSession(as).then((s) => {
      setSession(s);
      // Pick the first word on the client (after mount) to avoid an SSR
      // hydration mismatch from Math.random; keep any word already chosen.
      setWord((w) => w || pickRandomWord());
    });
  }, [as]);

  const canSubmit = useMemo(
    () => Boolean(session && word && drawing.length > 0),
    [session, word, drawing],
  );

  const submit = useCallback(async () => {
    if (!session) return;
    setStatus('Submitting…');
    await submitTurn({
      gameId: session.gameId,
      drawerId: session.me.id,
      guesserId: session.opponent.id,
      word,
      strokes: drawing,
    });
    setStatus(`Sent to ${session.opponent.displayName}! Pick a new word to draw again.`);
    setDrawing([]);
    setWord(pickRandomWord(word));
  }, [session, word, drawing]);

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Draw</h1>
        <nav className="flex gap-4 text-sm">
          <Link href="/play" className="text-blue-600 underline">
            Guess →
          </Link>
          <Link href="/scores" className="text-blue-600 underline">
            Scores
          </Link>
        </nav>
      </div>

      <PlayerSwitch value={as} onChange={setAs} />
      {session && (
        <p className="text-sm text-gray-500">
          You are <strong>{session.me.displayName}</strong>, drawing for{' '}
          <strong>{session.opponent.displayName}</strong>.
        </p>
      )}

      <div className="flex items-center gap-3">
        <span className="text-lg">
          Draw: <strong className="tracking-wide">{word || '…'}</strong>
        </span>
        <button
          type="button"
          className="rounded border px-2 py-1 text-sm"
          onClick={() => setWord(pickRandomWord(word))}
        >
          New word
        </button>
      </div>

      <DrawCanvas onChange={setDrawing} />

      <button
        type="button"
        disabled={!canSubmit}
        onClick={submit}
        className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-40"
      >
        Submit drawing
      </button>

      {status && <p className="text-sm text-green-700">{status}</p>}
    </main>
  );
}
