'use client';

import { useMemo, useState } from 'react';

export interface LetterTilesProps {
  /** Tray of single-uppercase-letter strings (answer letters + decoys, pre-shuffled). */
  tiles: string[];
  /** Number of blanks to fill (answer length, excluding spaces). */
  length: number;
  /** Called with the assembled uppercase guess once every blank is filled. */
  onComplete: (guess: string) => void;
  /**
   * Optional expected answer (uppercase, spaces already dropped). When given,
   * a filled blank whose letter doesn't match the expected letter at that
   * position is flagged wrong (data-wrong / aria-invalid) — GUESS-03 feedback.
   * It never blocks input; guessing stays free-form.
   */
  expected?: string;
  /**
   * Optional pre-placed, locked hint letters keyed by blank index (GUESS-05).
   * The tile filling a locked blank is chosen from `tiles` and can't be cleared,
   * and its tray tile is consumed like any other.
   */
  locked?: Record<number, string>;
}

/**
 * Draw Something-style guessing input: a row of blanks and a tray of tappable
 * letter tiles. Tapping a tray tile fills the next empty (unlocked) blank and
 * consumes that specific tile (tracked by index so duplicate letters work).
 * Tapping a filled, unlocked blank clears it and returns its tile to the tray.
 * When all blanks are filled, onComplete fires with the concatenated letters.
 */
export function LetterTiles({
  tiles,
  length,
  onComplete,
  expected,
  locked,
}: LetterTilesProps) {
  // Which blank indexes are locked hints, and the initial slot assignment that
  // pre-places each locked letter onto a matching tray tile (by index).
  const { lockedSet, initialSlots } = useMemo(() => {
    const set = new Set<number>();
    const slots: (number | null)[] = Array(length).fill(null);
    const taken = new Set<number>();
    if (locked) {
      for (const [key, letter] of Object.entries(locked)) {
        const slotIndex = Number(key);
        if (slotIndex < 0 || slotIndex >= length) continue;
        const tileIndex = tiles.findIndex(
          (t, i) => t === letter.toUpperCase() && !taken.has(i),
        );
        if (tileIndex === -1) continue; // no matching tile to lock onto
        taken.add(tileIndex);
        slots[slotIndex] = tileIndex;
        set.add(slotIndex);
      }
    }
    return { lockedSet: set, initialSlots: slots };
    // tiles/locked/length identity is stable per turn (parent keys by turn id).
  }, [tiles, locked, length]);

  // Each blank holds the tray index of the tile placed in it, or null.
  const [slots, setSlots] = useState<(number | null)[]>(initialSlots);

  const usedTileIndexes = new Set(slots.filter((s): s is number => s !== null));

  function placeTile(tileIndex: number) {
    const nextEmpty = slots.findIndex((s) => s === null);
    if (nextEmpty === -1) return; // all blanks already filled
    const next = slots.slice();
    next[nextEmpty] = tileIndex;
    setSlots(next);

    if (next.every((s) => s !== null)) {
      const guess = next.map((s) => tiles[s as number]).join('').toUpperCase();
      onComplete(guess);
    }
  }

  function clearSlot(slotIndex: number) {
    if (lockedSet.has(slotIndex)) return; // hints can't be cleared
    if (slots[slotIndex] === null) return;
    const next = slots.slice();
    next[slotIndex] = null;
    setSlots(next);
  }

  return (
    <div>
      <div role="group" aria-label="answer" style={{ display: 'flex', gap: '0.5rem' }}>
        {slots.map((tileIndex, i) => {
          const filled = tileIndex !== null;
          const letter = filled ? tiles[tileIndex] : '';
          const isLocked = lockedSet.has(i);
          // Wrong when a non-locked blank is filled with a letter that doesn't
          // match the expected letter at this position.
          const wrong =
            filled &&
            !isLocked &&
            expected !== undefined &&
            expected[i] !== undefined &&
            letter !== expected[i];
          return (
            <button
              key={i}
              type="button"
              data-role="blank"
              data-wrong={wrong ? 'true' : undefined}
              data-locked={isLocked ? 'true' : undefined}
              aria-label={
                filled
                  ? wrong
                    ? `${letter} (wrong)`
                    : letter
                  : `blank ${i + 1}`
              }
              onClick={() => clearSlot(i)}
              disabled={!filled || isLocked}
            >
              {letter || '_'}
            </button>
          );
        })}
      </div>

      <div role="group" aria-label="tiles" style={{ display: 'flex', gap: '0.5rem' }}>
        {tiles.map((letter, i) => {
          const used = usedTileIndexes.has(i);
          return (
            <button
              key={i}
              type="button"
              data-role="tile"
              aria-label={letter}
              onClick={() => placeTile(i)}
              disabled={used}
            >
              {letter}
            </button>
          );
        })}
      </div>
    </div>
  );
}
