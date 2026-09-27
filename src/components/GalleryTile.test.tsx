import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, afterEach, vi } from 'vitest';
import type { Drawing } from '@/lib/strokes';
import { GalleryTile, type GalleryTileData } from './GalleryTile';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const drawing: Drawing = [
  { color: '#111827', width: 4, points: [{ x: 0, y: 0 }, { x: 10, y: 10 }] },
];

const base: GalleryTileData = {
  turnId: 't1',
  word: 'cat',
  drawing,
  drawerName: 'Evan',
  status: 'guessed',
  pointsAwarded: 1,
};

describe('GalleryTile', () => {
  it('shows the word, who drew it, and the outcome', () => {
    render(<GalleryTile entry={base} />);
    expect(screen.getByText('“cat”')).toBeInTheDocument();
    expect(screen.getByText(/Evan drew it/)).toBeInTheDocument();
    expect(screen.getByText(/Guessed · \+1/)).toBeInTheDocument();
  });

  it('labels a give-up outcome without points', () => {
    render(
      <GalleryTile entry={{ ...base, status: 'gave_up', pointsAwarded: 0 }} />,
    );
    expect(screen.getByText(/Gave up/)).toBeInTheDocument();
  });

  it('opens the animated replay when the thumbnail is tapped, and closes again', async () => {
    const user = userEvent.setup();
    render(<GalleryTile entry={base} />);

    // Starts as a static thumbnail (no replay controls).
    expect(screen.getByRole('img', { name: 'Drawing of cat' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^replay$/i })).toBeNull();

    await user.click(
      screen.getByRole('button', { name: /replay the drawing of cat/i }),
    );
    // Replay controls appear.
    expect(screen.getByRole('button', { name: /^replay$/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /close replay/i }));
    expect(screen.getByRole('img', { name: 'Drawing of cat' })).toBeInTheDocument();
  });
});
