'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { GameShell } from '@/components/GameShell';
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
  const drafts = useRef(new Map<string, { word: string; drawing: Drawing }>());
  const [loadError, setLoadError] = useState(false);
  const [me, setMe] = useState<Person | null>(null);
  const [friends, setFriends] = useState<FriendInfo[]>([]);
  const [friendIndex, setFriendIndex] = useState(0);
  const [word, setWord] = useState('');
  const [drawing, setDrawing] = useState<Drawing>([]);
  const [busy, setBusy] = useState(false);
  const [canvasVersion, setCanvasVersion] = useState(0);
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    fetchAuthSession()
      .then((s) => {
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
      })
      .catch(() => setLoadError(true));
  }, [router]);

  const opponent = friends[friendIndex];

  // Offer a word from the selected game's enabled packs once we know the
  // opponent. Runs on the client (after mount) to avoid an SSR hydration
  // mismatch from Math.random, and re-offers when switching opponents.
  useEffect(() => {
    if (!opponent || drafts.current.has(opponent.gameId)) return;
    let active = true;
    offerWord(opponent.gameId).then((w) => {
      if (active) {
        setWord(w);
        drafts.current.set(opponent.gameId, { word: w, drawing: [] });
      }
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
      drafts.current.delete(opponent.gameId);
      setDrawing([]);
      setCanvasVersion((version) => version + 1);
      const next = await offerWord(opponent.gameId, word);
      setWord(next);
      drafts.current.set(opponent.gameId, { word: next, drawing: [] });
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
    const next = await offerWord(opponent.gameId, word);
    setWord(next);
    drafts.current.set(opponent.gameId, { word: next, drawing: [] });
    setBusy(false);
  }, [opponent, word, busy]);

  return (
    <GameShell
      title="Make your mark."
      eyebrow="The drawing table"
      current="/draw"
    >
      {loadError && (
        <div className="notice notice-error" role="alert">
          We couldn’t load your games.{' '}
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
          Getting your pencil box ready…
        </p>
      )}
      {me && friends.length === 0 && (
        <div className="empty-panel">
          <h2>Good drawings need good company.</h2>
          <p>Invite someone and start your first drawing together.</p>
          <Link className="button" href="/friends">
            Find a friend to play with
          </Link>
        </div>
      )}
      {opponent && (
        <>
          <div className="recipient-row">
            <span className="avatar avatar-0" aria-hidden="true">
              {opponent.opponent.displayName.slice(0, 1).toUpperCase()}
            </span>
            <label className="recipient-picker">
              <span className="eyebrow">Draw for</span>
              <select
                aria-label="Draw for"
                value={friendIndex}
                disabled={busy}
                onChange={(e) => {
                  const index = Number(e.target.value);
                  const saved = drafts.current.get(friends[index].gameId);
                  setFriendIndex(index);
                  setWord(saved?.word ?? '');
                  setDrawing(saved?.drawing ?? []);
                  setStatus('');
                }}
              >
                {friends.map((f, i) => (
                  <option key={f.gameId} value={i}>
                    {f.opponent.displayName}
                  </option>
                ))}
              </select>
            </label>
            <Link className="text-link" href="/packs">
              Word packs
            </Link>
          </div>
          <div className="word-prompt">
            <div>
              <span className="eyebrow">Your word</span>
              <h2>{word || 'Choosing…'}</h2>
            </div>
            <button
              className="tool-button"
              onClick={newWord}
              disabled={busy || !word}
            >
              New word <span aria-hidden="true">↻</span>
            </button>
          </div>
          <DrawCanvas
            key={`${opponent.gameId}:${canvasVersion}`}
            initialDrawing={drawing}
            disabled={busy || !word}
            onChange={(next) => {
              setDrawing(next);
              drafts.current.set(opponent.gameId, { word, drawing: next });
            }}
          />
          <div className="send-panel">
            <p>
              {busy ? 'One moment…' : 'A little imperfect is a lot more fun.'}
            </p>
            <button
              className="button"
              type="button"
              aria-label="Submit drawing"
              disabled={!canSubmit}
              onClick={submit}
            >
              {busy ? 'Sending…' : 'Send drawing'}{' '}
              <span aria-hidden="true">↗</span>
            </button>
          </div>
          <p className="field-hint">
            Switch friends freely. Drafts stay here until you leave this page.
          </p>
        </>
      )}
      {status && (
        <p className="notice" role="status">
          {status}
        </p>
      )}
    </GameShell>
  );
}
