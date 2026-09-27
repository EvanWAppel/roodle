'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { GameShell } from '@/components/GameShell';
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
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [replyGame, setReplyGame] = useState<string | null>(null);
  const [me, setMe] = useState<Person | null>(null);
  const [friends, setFriends] = useState<FriendInfo[]>([]);
  const [pending, setPending] = useState<TurnDTO[]>([]);
  const [active, setActive] = useState<TurnDTO | null>(null);
  const [result, setResult] = useState<string>('');
  const [wrong, setWrong] = useState(false);

  const refresh = useCallback(async (guesserId: string) => {
    const p = await fetchPending(guesserId);
    setPending(p);
    return p;
  }, []);

  useEffect(() => {
    fetchAuthSession()
      .then(async (s) => {
        if (!s.me) {
          router.replace('/signin');
          return;
        }
        setMe(s.me);
        setFriends(s.friends);
        setResult('');
        setWrong(false);
        const pend = await refresh(s.me.id);
        // Honor an email nudge's deep link (/play?turn=<id>): auto-open that turn
        // if it's still pending, else fall back to the list (NOTIF-04).
        const turnParam = new URLSearchParams(window.location.search).get(
          'turn',
        );
        setActive(
          turnParam ? (pend.find((t) => t.id === turnParam) ?? null) : null,
        );
      })
      .catch(() => setLoadError(true));
  }, [router, refresh]);

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
      if (!active || !me || busy) return;
      setBusy(true);
      try {
        const updated = await submitGuess(active.id, guess);
        if (updated.status === 'guessed') {
          setWrong(false);
          setResult(
            `Correct! +${updated.pointsAwarded} point 🎉 (it was "${active.word}")`,
          );
          setReplyGame(active.gameId);
          setActive(null);
          await refresh(me.id).catch(() => setLoadError(true));
        } else {
          setWrong(true);
          setResult('Not quite — try again.');
        }
      } catch {
        setResult(
          'Couldn’t check your guess. Tap an answer letter and try again.',
        );
      } finally {
        setBusy(false);
      }
    },
    [active, me, refresh, busy],
  );

  // Dismiss the wrong-state as soon as the player edits their guess again.
  const onEdit = useCallback(() => {
    setWrong(false);
    setResult('');
  }, []);

  const onGiveUp = useCallback(async () => {
    if (!active || !me || busy) return;
    setBusy(true);
    try {
      const updated = await giveUp(active.id);
      setResult(`The word was "${updated.word}". No points this time.`);
      setReplyGame(active.gameId);
      setActive(null);
      setWrong(false);
      await refresh(me.id).catch(() => setLoadError(true));
    } catch {
      setResult('Couldn’t reveal the word. Please try again.');
    } finally {
      setBusy(false);
    }
  }, [active, me, refresh, busy]);

  const opponentName = (gameId: string) =>
    friends.find((f) => f.gameId === gameId)?.opponent.displayName ??
    'a friend';

  return (
    <GameShell
      title={active ? 'What could it be?' : 'A little mystery.'}
      eyebrow="The guessing room"
      current="/play"
    >
      {loadError && (
        <div className="notice notice-error" role="alert">
          We couldn’t load your latest drawings.{' '}
          <button
            className="text-link"
            onClick={() => window.location.reload()}
          >
            Try again
          </button>
        </div>
      )}
      {!me && !loadError && (
        <p className="notice" role="status">
          Opening your drawings…
        </p>
      )}
      {result && (
        <div
          className={`notice ${wrong ? 'notice-error' : replyGame ? 'notice-success' : ''}`}
          role="status"
        >
          <p>{result}</p>
          {replyGame && (
            <Link
              className="button"
              href={`/draw?game=${encodeURIComponent(replyGame)}`}
            >
              Draw something back <span aria-hidden="true">↗</span>
            </Link>
          )}
        </div>
      )}
      {me && !active && (
        <>
          <p className="page-description">
            {pending.length
              ? `${pending.length} drawing${pending.length === 1 ? '' : 's'} waiting for your best guess.`
              : 'All caught up. A blank page is a good place to start.'}
          </p>
          <ul className="pending-list">
            {pending.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  className="pending-card"
                  aria-label={`A drawing to guess from ${opponentName(t.gameId)} (${t.word.replace(/\s+/g, '').length} letters)`}
                  onClick={() => {
                    setActive(t);
                    setResult('');
                    setWrong(false);
                    setReplyGame(null);
                  }}
                >
                  <span className="avatar avatar-0" aria-hidden="true">
                    {opponentName(t.gameId).slice(0, 1).toUpperCase()}
                  </span>
                  <span>
                    <strong>{opponentName(t.gameId)}</strong>
                    <small>
                      {t.word.replace(/\s+/g, '').length} letters · ready to
                      guess
                    </small>
                  </span>
                  <span className="pending-arrow" aria-hidden="true">
                    ↗
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {pending.length === 0 && (
            <div className="empty-panel">
              <span className="empty-mark" aria-hidden="true">
                ✳
              </span>
              <h2>
                {friends.length
                  ? 'Your next masterpiece awaits.'
                  : 'A game is better with a friend.'}
              </h2>
              <p>
                {friends.length
                  ? 'Send a drawing while you wait for one to come your way.'
                  : 'Invite someone to start swapping drawings.'}
              </p>
              <Link
                className="button"
                href={friends.length ? '/draw' : '/friends'}
              >
                {friends.length ? 'Draw something' : 'Invite someone to play'}
              </Link>
            </div>
          )}
        </>
      )}
      {active && (
        <section className="guess-workspace" aria-label="Guess this drawing">
          <div className="recipient-row">
            <span className="avatar avatar-0" aria-hidden="true">
              {opponentName(active.gameId).slice(0, 1).toUpperCase()}
            </span>
            <div className="recipient-picker">
              <span className="eyebrow">A drawing from</span>
              <strong>{opponentName(active.gameId)}</strong>
            </div>
            <button
              type="button"
              className="text-link"
              disabled={busy}
              onClick={() => {
                setActive(null);
                setResult('');
                setWrong(false);
              }}
            >
              All drawings
            </button>
          </div>
          <DrawingReplay drawing={active.strokes} />
          <LetterTiles
            key={active.id}
            tiles={tiles}
            length={blanks}
            onComplete={onComplete}
            wrong={wrong}
            onChange={onEdit}
            disabled={busy}
          />
          {busy && (
            <p role="status" className="field-hint">
              Checking…
            </p>
          )}
          <button
            type="button"
            className="text-link reveal-button"
            disabled={busy}
            onClick={onGiveUp}
          >
            Give up / reveal
          </button>
        </section>
      )}
    </GameShell>
  );
}
