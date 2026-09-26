'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { fetchAuthSession, type FriendInfo } from '@/lib/api';

interface PackRow {
  id: string;
  name: string;
  isBuiltin: boolean;
  enabled: boolean;
}

/**
 * WORD-06: manage word packs. Pick a game (friend), toggle which packs are
 * enabled for it, and create a custom pack (posts to /api/packs). Enabled state
 * is per-game (game_packs); difficulty is metadata only and does not affect
 * scoring.
 */
export default function PacksPage() {
  const router = useRouter();
  const [friends, setFriends] = useState<FriendInfo[]>([]);
  const [gameId, setGameId] = useState<string>('');
  const [packs, setPacks] = useState<PackRow[]>([]);
  const [name, setName] = useState('');
  const [wordsText, setWordsText] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    fetchAuthSession().then((s) => {
      if (!s.me) {
        router.replace('/signin');
        return;
      }
      setFriends(s.friends);
      if (s.friends[0]) setGameId(s.friends[0].gameId);
    });
  }, [router]);

  const loadPacks = useCallback(async (gid: string) => {
    if (!gid) return;
    const res = await fetch(`/api/packs?gameId=${encodeURIComponent(gid)}`);
    if (!res.ok) return;
    setPacks((await res.json()) as PackRow[]);
  }, []);

  useEffect(() => {
    if (!gameId) return;
    let active = true;
    fetch(`/api/packs?gameId=${encodeURIComponent(gameId)}`)
      .then((res) => (res.ok ? (res.json() as Promise<PackRow[]>) : null))
      .then((rows) => {
        if (active && rows) setPacks(rows);
      });
    return () => {
      active = false;
    };
  }, [gameId]);

  const toggle = useCallback(
    async (packId: string, enabled: boolean) => {
      await fetch('/api/packs/enable', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ gameId, packId, enabled }),
      });
      await loadPacks(gameId);
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
        setStatus('Give the pack a name and at least one word.');
        return;
      }
      setStatus('Saving…');
      const res = await fetch('/api/packs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, words }),
      });
      if (!res.ok) {
        setStatus('That didn’t work — try again.');
        return;
      }
      setName('');
      setWordsText('');
      setStatus('Pack created!');
      await loadPacks(gameId);
    },
    [name, wordsText, gameId, loadPacks],
  );

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Word packs</h1>
        <Link href="/draw" className="text-sm text-blue-600 underline">
          Draw →
        </Link>
      </div>

      {friends.length === 0 && (
        <p className="text-sm text-gray-500">
          You have no friends yet.{' '}
          <Link href="/friends" className="text-blue-600 underline">
            Invite a friend
          </Link>{' '}
          to set up packs for a game.
        </p>
      )}

      {friends.length > 0 && (
        <>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">Packs for game with:</span>
            <select
              aria-label="Game"
              value={gameId}
              onChange={(e) => setGameId(e.target.value)}
              className="rounded border px-2 py-1"
            >
              {friends.map((f) => (
                <option key={f.gameId} value={f.gameId}>
                  {f.opponent.displayName}
                </option>
              ))}
            </select>
          </label>

          <ul className="flex flex-col gap-2">
            {packs.map((p) => (
              <li key={p.id} className="flex items-center gap-2 text-sm">
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

          <form onSubmit={createPack} className="flex flex-col gap-2 border-t pt-4">
            <h2 className="font-semibold">Create a custom pack</h2>
            <input
              aria-label="Pack name"
              placeholder="Pack name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded border px-3 py-2"
            />
            <textarea
              aria-label="Words"
              placeholder="Words, separated by commas or new lines"
              value={wordsText}
              onChange={(e) => setWordsText(e.target.value)}
              className="rounded border px-3 py-2"
              rows={4}
            />
            <button
              type="submit"
              className="rounded bg-blue-600 px-4 py-2 text-white"
            >
              Create pack
            </button>
          </form>
        </>
      )}

      {status && <p className="text-sm text-gray-700">{status}</p>}
    </main>
  );
}
