'use client';

import { useState } from 'react';

export interface LetterTilesProps {
  /** Tray of single-uppercase-letter strings (answer letters + decoys, pre-shuffled). */
  tiles: string[];
  /** Number of blanks to fill (answer length, excluding spaces). */
  length: number;
  /** Called with the assembled uppercase guess once every blank is filled. */
  onComplete: (guess: string) => void;
}

/**
 * Draw Something-style guessing input: a row of blanks and a tray of tappable
 * letter tiles. Tapping a tray tile fills the next empty blank and consumes
 * that specific tile (tracked by index so duplicate letters work). Tapping a
 * filled blank clears it and returns its tile to the tray. When all blanks are
 * filled, onComplete fires with the concatenated uppercase letters.
 */
export function LetterTiles({ tiles, length, onComplete }: LetterTilesProps) {
  // Each blank holds the tray index of the tile placed in it, or null.
  const [slots, setSlots] = useState<(number | null)[]>(() => Array(length).fill(null));

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
          return (
            <button
              key={i}
              type="button"
              data-role="blank"
              aria-label={filled ? letter : `blank ${i + 1}`}
              onClick={() => clearSlot(i)}
              disabled={!filled}
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
