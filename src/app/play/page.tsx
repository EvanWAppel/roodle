'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DrawingReplay } from '@/components/DrawingReplay';
import { LetterTiles } from '@/components/LetterTiles';
import { buildTileTray } from '@/lib/guess';
import {
  fetchAuthSession,
  fetchPending,
  submitGuess,
  giveUp,
  type Person,
  type FriendInfo,
  type TurnDTO,
} from '@/lib/api';

export default function PlayPage() {
  const router = useRouter();
  const [me, setMe] = useState<Person | null>(null);
  const [friends, setFriends] = useState<FriendInfo[]>([]);
  const [pending, setPending] = useState<TurnDTO[]>([]);
  const [active, setActive] = useState<TurnDTO | null>(null);
  const [result, setResult] = useState<string>('');

  const refresh = useCallback(async (guesserId: string) => {
    setPending(await fetchPending(guesserId));
  }, []);

  useEffect(() => {
    fetchAuthSession().then(async (s) => {
      if (!s.me) {
        router.replace('/signin');
        return;
      }
      setMe(s.me);
      setFriends(s.friends);
      setActive(null);
      setResult('');
      await refresh(s.me.id);
    });
  }, [router, refresh]);

  const [hintCount, setHintCount] = useState(0);

  const tiles = useMemo(
    () => (active ? buildTileTray(active.word) : []),
    [active],
  );
  const answer = useMemo(
    () => (active ? active.word.toUpperCase().replace(/\s+/g, '') : ''),
    [active],
  );
  const blanks = answer.length;

  // GUESS-05 hint: reveal the first `hintCount` letters, pre-placed and locked.
  const locked = useMemo(() => {
    const map: Record<number, string> = {};
    for (let i = 0; i < hintCount && i < answer.length; i++) {
      map[i] = answer[i];
    }
    return map;
  }, [answer, hintCount]);

  const onComplete = useCallback(
    async (guess: string) => {
      if (!active || !me) return;
      const updated = await submitGuess(active.id, guess);
      if (updated.status === 'guessed') {
        setResult(`Correct! +${updated.pointsAwarded} point 🎉 (it was "${active.word}")`);
        setActive(null);
        await refresh(me.id);
      } else {
        setResult('Not quite — try again.');
      }
    },
    [active, me, refresh],
  );

  const onGiveUp = useCallback(async () => {
    if (!active || !me) return;
    const updated = await giveUp(active.id);
    setResult(`The word was "${updated.word}". No points this time.`);
    setActive(null);
    await refresh(me.id);
  }, [active, me, refresh]);

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

      {me && (
        <p className="text-sm text-gray-500">
          You are <strong>{me.displayName}</strong>. {pending.length} drawing(s)
          waiting.
        </p>
      )}

      {me && friends.length === 0 && pending.length === 0 && (
        <p className="text-sm text-gray-500">
          You have no friends yet.{' '}
          <Link href="/friends" className="text-blue-600 underline">
            Invite a friend
          </Link>{' '}
          to start playing.
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
                  setHintCount(0);
                }}
              >
                A drawing to guess ({t.word.replace(/\s+/g, '').length} letters)
              </button>
            </li>
          ))}
          {pending.length === 0 && friends.length > 0 && (
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
            expected={answer}
            locked={locked}
          />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setHintCount((n) => Math.min(n + 1, blanks - 1))}
              disabled={hintCount >= blanks - 1}
              className="self-start rounded border px-3 py-1 text-sm text-gray-600 disabled:opacity-50"
            >
              Hint ({hintCount} shown)
            </button>
            <button
              type="button"
              onClick={onGiveUp}
              className="self-start rounded border px-3 py-1 text-sm text-gray-600"
            >
              Give up / reveal
            </button>
          </div>
        </div>
      )}

      {result && <p className="text-sm font-medium text-green-700">{result}</p>}
    </main>
  );
}
