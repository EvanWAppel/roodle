import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Drawing } from '@/lib/strokes';
import { ERASER_COLOR, DEFAULT_INK } from '@/lib/strokes';
import { DrawCanvas } from './DrawCanvas';

/**
 * jsdom 30 supports pointer events; getBoundingClientRect() returns zeros, so
 * canvas-relative coordinates equal the event's clientX/clientY.
 */
describe('DrawCanvas', () => {
  function getCanvas(): HTMLCanvasElement {
    const canvas = document.querySelector('canvas');
    if (!canvas) throw new Error('canvas not found');
    return canvas;
  }

  function stroke(canvas: HTMLCanvasElement, pts: [number, number][]) {
    fireEvent.pointerDown(canvas, { clientX: pts[0][0], clientY: pts[0][1] });
    for (const [x, y] of pts.slice(1)) {
      fireEvent.pointerMove(canvas, { clientX: x, clientY: y });
    }
    const last = pts[pts.length - 1];
    fireEvent.pointerUp(canvas, { clientX: last[0], clientY: last[1] });
  }

  it('records a stroke with ordered points and the default ink/width', () => {
    const onChange = vi.fn<(drawing: Drawing) => void>();
    render(<DrawCanvas onChange={onChange} />);
    stroke(getCanvas(), [
      [10, 15],
      [20, 25],
      [30, 35],
      [40, 45],
    ]);

    const last = onChange.mock.calls.at(-1)![0].at(-1)!;
    expect(last.points).toEqual([
      { x: 10, y: 15 },
      { x: 20, y: 25 },
      { x: 30, y: 35 },
      { x: 40, y: 45 },
    ]);
    expect(last.color).toBe(DEFAULT_INK);
    expect(typeof last.width).toBe('number');
  });

  it('records the chosen color', () => {
    const onChange = vi.fn<(drawing: Drawing) => void>();
    render(<DrawCanvas onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('color #ef4444'));
    stroke(getCanvas(), [
      [1, 1],
      [2, 2],
    ]);
    expect(onChange.mock.calls.at(-1)![0].at(-1)!.color).toBe('#ef4444');
  });

  it('records eraser strokes in the background color', () => {
    const onChange = vi.fn<(drawing: Drawing) => void>();
    render(<DrawCanvas onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /eraser/i }));
    stroke(getCanvas(), [
      [1, 1],
      [2, 2],
    ]);
    expect(onChange.mock.calls.at(-1)![0].at(-1)!.color).toBe(ERASER_COLOR);
  });

  it('undo removes the last stroke', () => {
    const onChange = vi.fn<(drawing: Drawing) => void>();
    render(<DrawCanvas onChange={onChange} />);
    const canvas = getCanvas();
    stroke(canvas, [
      [1, 1],
      [2, 2],
    ]);
    stroke(canvas, [
      [5, 5],
      [6, 6],
    ]);
    onChange.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /undo/i }));
    expect(onChange.mock.calls.at(-1)![0]).toHaveLength(1);
  });

  it('clear empties the drawing', () => {
    const onChange = vi.fn<(drawing: Drawing) => void>();
    render(<DrawCanvas onChange={onChange} />);
    stroke(getCanvas(), [
      [1, 2],
      [3, 4],
    ]);
    onChange.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /clear/i }));
    expect(onChange).toHaveBeenCalledWith([]);
  });
});
