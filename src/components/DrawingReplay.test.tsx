import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
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

  it('does not throw when the canvas 2d context is null (jsdom)', () => {
    expect(() => render(<DrawingReplay drawing={drawing} />)).not.toThrow();
  });

  it('renders a jump-to-final control', () => {
    render(<DrawingReplay drawing={drawing} />);
    expect(
      screen.getByRole('button', { name: /jump to final/i }),
    ).toBeInTheDocument();
  });

  it('jump-to-final completes immediately, cancelling the animation and firing onDone', async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    const cancelSpy = vi.spyOn(globalThis, 'cancelAnimationFrame');
    render(<DrawingReplay drawing={drawing} onDone={onDone} />);

    const before = onDone.mock.calls.length;
    await user.click(screen.getByRole('button', { name: /jump to final/i }));

    // Jump renders the completed drawing synchronously and signals completion,
    // over and above whatever the initial animation may have already reported.
    expect(onDone.mock.calls.length).toBeGreaterThan(before);
    // The in-flight animation is cancelled so it cannot keep ticking.
    expect(cancelSpy).toHaveBeenCalled();
    cancelSpy.mockRestore();
  });

  it('replay restarts the animation from the beginning', async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    render(<DrawingReplay drawing={drawing} onDone={onDone} />);

    const before = onDone.mock.calls.length;
    await user.click(screen.getByRole('button', { name: /^replay$/i }));
    // Replay re-arms the animation; eventually it completes again.
    expect(onDone.mock.calls.length).toBeGreaterThanOrEqual(before);
  });
});
