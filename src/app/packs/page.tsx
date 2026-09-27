'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { GameShell } from '@/components/GameShell';
import { useRouter } from 'next/navigation';
import { fetchAuthSession, type FriendInfo } from '@/lib/api';

interface PackRow {
  id: string;
  name: string;
  isBuiltin: boolean;
  enabled: boolean;
}

/**
 * WORD-06 / DESIGN-09: manage word packs. Pick a game (friend), toggle which
 * packs are enabled for it, and create a custom pack (posts to /api/packs).
 * Enabled state is per-game (game_packs); difficulty is metadata only and does
 * not affect scoring. Fetch failures surface as inline notices with retry — they
 * are never swallowed.
 */
export default function PacksPage() {
  const router = useRouter();
  const [sessionState, setSessionState] = useState<
    'loading' | 'ready' | 'error'
  >('loading');
  const [friends, setFriends] = useState<FriendInfo[]>([]);
  const [gameId, setGameId] = useState<string>('');
  const [packs, setPacks] = useState<PackRow[]>([]);
  const [packsState, setPacksState] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  const [toggleError, setToggleError] = useState<{
    packId: string;
    enabled: boolean;
  } | null>(null);
  const [name, setName] = useState('');
  const [wordsText, setWordsText] = useState('');
  const [createStatus, setCreateStatus] = useState<{
    kind: 'idle' | 'saving' | 'success' | 'error';
    message: string;
  }>({ kind: 'idle', message: '' });

  const loadSession = useCallback(async () => {
    setSessionState('loading');
    try {
      const s = await fetchAuthSession();
      if (!s.me) {
        router.replace('/signin');
        return;
      }
      setFriends(s.friends);
      if (s.friends[0]) setGameId(s.friends[0].gameId);
      setSessionState('ready');
    } catch {
      setSessionState('error');
    }
  }, [router]);

  useEffect(() => {
    // Defer into a microtask so setState runs outside the effect body.
    Promise.resolve().then(loadSession);
  }, [loadSession]);

  const loadPacks = useCallback(async (gid: string) => {
    if (!gid) return;
    setPacksState('loading');
    try {
      const res = await fetch(`/api/packs?gameId=${encodeURIComponent(gid)}`);
      if (!res.ok) {
        setPacksState('error');
        return;
      }
      setPacks((await res.json()) as PackRow[]);
      setPacksState('ready');
    } catch {
      setPacksState('error');
    }
  }, []);

  useEffect(() => {
    if (!gameId) return;
    Promise.resolve().then(() => {
      // Clear per-game feedback so a stale toggle-retry can't write to the newly
      // selected game with the previous game's pack id.
      setToggleError(null);
      setCreateStatus({ kind: 'idle', message: '' });
      return loadPacks(gameId);
    });
  }, [gameId, loadPacks]);

  const toggle = useCallback(
    async (packId: string, enabled: boolean) => {
      setToggleError(null);
      try {
        const res = await fetch('/api/packs/enable', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ gameId, packId, enabled }),
        });
        if (!res.ok) {
          setToggleError({ packId, enabled });
          return;
        }
        await loadPacks(gameId);
      } catch {
        setToggleError({ packId, enabled });
      }
    },
    [gameId, loadPacks],
  );

  const createPack = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const words = wordsText
        .split(/[\n,]/)
        .map((w) => w.trim())
        .filter(Boolean);
      if (!name.trim() || words.length === 0) {
        setCreateStatus({
          kind: 'error',
          message: 'Give the pack a name and at least one word.',
        });
        return;
      }
      setCreateStatus({ kind: 'saving', message: 'Saving…' });
      try {
        const res = await fetch('/api/packs', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name, words }),
        });
        if (!res.ok) {
          setCreateStatus({
            kind: 'error',
            message: 'That didn’t work — try again.',
          });
          return;
        }
        setName('');
        setWordsText('');
        setCreateStatus({ kind: 'success', message: 'Pack created!' });
        await loadPacks(gameId);
      } catch {
        setCreateStatus({
          kind: 'error',
          message: 'Could not connect. Please try again.',
        });
      }
    },
    [name, wordsText, gameId, loadPacks],
  );

  return (
    <GameShell
      title="Words worth drawing."
      eyebrow="Your pencil’s next adventure"
      current="/packs"
    >
      {sessionState === 'loading' && (
        <p className="page-description" role="status">
          Loading your packs…
        </p>
      )}

      {sessionState === 'error' && (
        <div className="notice notice-error" role="alert">
          <p>We couldn’t load your packs.</p>
          <button
            type="button"
            className="button button-outline button-small"
            onClick={() => void loadSession()}
          >
            Try again
          </button>
        </div>
      )}

      {sessionState === 'ready' && friends.length === 0 && (
        <div className="empty-panel">
          <span className="empty-mark" aria-hidden="true">
            ✏️
          </span>
          <h2>No games yet.</h2>
          <p>Packs are set per game, so first you’ll need a partner in crime.</p>
          <Link href="/friends" className="button">
            Invite a friend
          </Link>
        </div>
      )}

      {sessionState === 'ready' && friends.length > 0 && (
        <>
          <label className="pack-option">
            <span className="field-label">Packs for game with:</span>
            <select
              aria-label="Game"
              value={gameId}
              onChange={(e) => setGameId(e.target.value)}
              className="text-field"
            >
              {friends.map((f) => (
                <option key={f.gameId} value={f.gameId}>
                  {f.opponent.displayName}
                </option>
              ))}
            </select>
          </label>

          {packsState === 'loading' && (
            <p className="field-hint" role="status">
              Loading packs…
            </p>
          )}

          {packsState === 'error' && (
            <div className="notice notice-error" role="alert">
              <p>Couldn’t load packs for this game.</p>
              <button
                type="button"
                className="button button-outline button-small"
                onClick={() => void loadPacks(gameId)}
              >
                Try again
              </button>
            </div>
          )}

          {packsState === 'ready' && (
            <ul className="pack-list">
              {packs.map((p) => (
                <li key={p.id} className="pack-option">
                  <input
                    type="checkbox"
                    id={`pack-${p.id}`}
                    checked={p.enabled}
                    onChange={(e) => toggle(p.id, e.target.checked)}
                  />
                  <label htmlFor={`pack-${p.id}`}>
                    {p.name}
                    {p.isBuiltin ? '' : ' (custom)'}
                  </label>
                </li>
              ))}
            </ul>
          )}

          {toggleError && (
            <div className="notice notice-error" role="alert">
              <p>Couldn’t update that pack.</p>
              <button
                type="button"
                className="button button-outline button-small"
                onClick={() => toggle(toggleError.packId, toggleError.enabled)}
              >
                Try again
              </button>
            </div>
          )}

          <form onSubmit={createPack} className="form-panel">
            <h2>Create a custom pack</h2>
            <input
              aria-label="Pack name"
              placeholder="Pack name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-field"
            />
            <textarea
              aria-label="Words"
              placeholder="Words, separated by commas or new lines"
              value={wordsText}
              onChange={(e) => setWordsText(e.target.value)}
              className="text-field"
              rows={4}
            />
            <button
              type="submit"
              className="button"
              disabled={createStatus.kind === 'saving'}
            >
              {createStatus.kind === 'saving' ? 'Saving…' : 'Create pack'}
            </button>
            {createStatus.message && createStatus.kind !== 'saving' && (
              <p
                className={`notice ${
                  createStatus.kind === 'error' ? 'notice-error' : 'notice-success'
                }`}
                role={createStatus.kind === 'error' ? 'alert' : 'status'}
              >
                {createStatus.message}
              </p>
            )}
          </form>
        </>
      )}
    </GameShell>
  );
}
