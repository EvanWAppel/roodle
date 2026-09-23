'use client';

import { useState } from 'react';
import {
  createCustomPack,
  type Difficulty,
  type NewPackWord,
} from '@/lib/api';

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

export interface PackManagerProps {
  /**
   * Persists the pack. Defaults to the real POST /api/packs client. Injectable
   * so component tests can assert the exact payload without a network call.
   */
  onCreate?: (input: {
    name: string;
    words: NewPackWord[];
  }) => Promise<{ ok: true; packId: string }>;
}

/**
 * WORD-06: create a custom word pack. Enter a name and one word-per-line (each
 * line "word" or "word:difficulty"), then submit. Parses the textarea into
 * NewPackWord[] and posts them. Toggling packs enabled-per-game is a separate
 * per-game control; this component owns creation.
 */
export function PackManager({ onCreate = createCustomPack }: PackManagerProps) {
  const [name, setName] = useState('');
  const [wordsText, setWordsText] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  function parseWords(): NewPackWord[] {
    return wordsText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => {
        // "word" or "word:easy" — a per-line difficulty overrides the default.
        const [text, diff] = line.split(':').map((s) => s.trim());
        const d = DIFFICULTIES.includes(diff as Difficulty)
          ? (diff as Difficulty)
          : difficulty;
        return { text, difficulty: d };
      });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const words = parseWords();
    if (!name.trim()) {
      setStatus('Please name your pack.');
      return;
    }
    if (words.length === 0) {
      setStatus('Add at least one word.');
      return;
    }
    setBusy(true);
    setStatus('Creating…');
    // Errors are surfaced, not swallowed: let a failed request throw.
    const res = await onCreate({ name: name.trim(), words });
    setBusy(false);
    setStatus(`Created "${name.trim()}" with ${words.length} word(s).`);
    setName('');
    setWordsText('');
    return res;
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-gray-500">Pack name</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Pack name"
          className="rounded border px-2 py-1"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-gray-500">Default difficulty</span>
        <select
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value as Difficulty)}
          aria-label="Default difficulty"
          className="rounded border px-2 py-1"
        >
          {DIFFICULTIES.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-gray-500">
          Words (one per line, optionally &quot;word:difficulty&quot;)
        </span>
        <textarea
          value={wordsText}
          onChange={(e) => setWordsText(e.target.value)}
          aria-label="Words"
          rows={6}
          className="rounded border px-2 py-1 font-mono"
        />
      </label>

      <button
        type="submit"
        disabled={busy}
        className="self-start rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-40"
      >
        Create pack
      </button>

      {status && <p className="text-sm text-gray-700">{status}</p>}
    </form>
  );
}
