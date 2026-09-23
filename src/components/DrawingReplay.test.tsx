import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import type { Drawing } from '@/lib/strokes';
import { DrawingReplay, orderedPoints } from './DrawingReplay';

describe('orderedPoints', () => {
  it('flattens a two-stroke drawing in stroke-then-point order', () => {
    const drawing: Drawing = [
      {
        color: '#111827',
        width: 4,
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
      },
      {
        color: '#ef4444',
        width: 2,
        points: [
          { x: 2, y: 2 },
          { x: 3, y: 3 },
          { x: 4, y: 4 },
        ],
      },
    ];

    expect(orderedPoints(drawing)).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 3 },
      { x: 4, y: 4 },
    ]);
  });

  it('returns an empty array for an empty drawing', () => {
    expect(orderedPoints([])).toEqual([]);
  });
});

describe('DrawingReplay', () => {
  const drawing: Drawing = [
    {
      color: '#111827',
      width: 4,
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ],
    },
  ];

  it('renders a Replay button', () => {
    render(<DrawingReplay drawing={drawing} />);
    expect(screen.getByRole('button', { name: /replay/i })).toBeInTheDocument();
  });

  it('renders replay-again and jump-to-final controls (GUESS-01)', () => {
    render(<DrawingReplay drawing={drawing} />);
    expect(screen.getByRole('button', { name: /replay/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /show final/i })).toBeInTheDocument();
  });

  it('does not throw when the canvas 2d context is null (jsdom)', () => {
    expect(() => render(<DrawingReplay drawing={drawing} />)).not.toThrow();
  });

  it('replay-again and show-final are clickable without throwing (jsdom null ctx)', async () => {
    const user = userEvent.setup();
    render(<DrawingReplay drawing={drawing} />);
    await user.click(screen.getByRole('button', { name: /show final/i }));
    await user.click(screen.getByRole('button', { name: /replay/i }));
    expect(screen.getByRole('button', { name: /replay/i })).toBeInTheDocument();
  });
});
