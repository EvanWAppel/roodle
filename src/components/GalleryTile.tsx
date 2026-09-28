'use client';

import { useState } from 'react';
import type { Drawing } from '@/lib/strokes';
import { DrawingThumbnail } from './DrawingThumbnail';
import { DrawingReplay } from './DrawingReplay';

export interface GalleryTileData {
  turnId: string;
  word: string;
  drawing: Drawing;
  drawerName: string;
  status: 'guessed' | 'gave_up';
  pointsAwarded: number;
}

/**
 * One completed drawing in the gallery. Shows a static thumbnail by default;
 * tapping it swaps in the animated replay (with its own controls). Purely a view
 * over already-resolved data — the word shown here has already been revealed.
 */
export function GalleryTile({ entry }: { entry: GalleryTileData }) {
  const [open, setOpen] = useState(false);
  const outcome =
    entry.status === 'guessed'
      ? `Guessed · +${entry.pointsAwarded}`
      : 'Gave up';

  return (
    <article className="gallery-tile">
      {open ? (
        <DrawingReplay drawing={entry.drawing} width={400} height={300} />
      ) : (
        <button
          type="button"
          className="gallery-tile-open"
          onClick={() => setOpen(true)}
          aria-label={`Replay the drawing of ${entry.word}`}
        >
          <DrawingThumbnail
            drawing={entry.drawing}
            label={`Drawing of ${entry.word}`}
          />
        </button>
      )}
      <div className="gallery-caption">
        <strong>“{entry.word}”</strong>
        <small>
          {entry.drawerName} drew it · {outcome}
        </small>
        {open && (
          <button
            type="button"
            className="text-link"
            onClick={() => setOpen(false)}
          >
            Close replay
          </button>
        )}
      </div>
    </article>
  );
}

export default GalleryTile;
