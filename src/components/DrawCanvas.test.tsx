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
    fireEvent.click(screen.getByLabelText('red'));
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
  it('maps phone-sized canvas input back to stored drawing coordinates', () => {
    const onChange = vi.fn();
    render(<DrawCanvas onChange={onChange} />);
    const canvas = getCanvas();
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      x: 10,
      y: 20,
      left: 10,
      top: 20,
      width: 200,
      height: 150,
      right: 210,
      bottom: 170,
      toJSON: () => ({}),
    });
    stroke(canvas, [
      [60, 70],
      [110, 95],
    ]);
    expect(onChange.mock.calls.at(-1)?.[0][0].points).toEqual([
      { x: 100, y: 100 },
      { x: 200, y: 150 },
    ]);
  });
  it('restores a saved canvas and allows undoing its last stroke', () => {
    const onChange = vi.fn();
    const initialDrawing: Drawing = [
      { color: '#111827', width: 4, points: [{ x: 10, y: 20 }] },
    ];
    render(<DrawCanvas initialDrawing={initialDrawing} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Undo/i }));
    expect(onChange).toHaveBeenCalledWith([]);
    expect(initialDrawing).toHaveLength(1);
  });
  it('ignores a second finger while recording a captured stroke', () => {
    const onChange = vi.fn();
    render(<DrawCanvas onChange={onChange} />);
    const canvas = getCanvas();
    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(canvas, { pointerId: 2, clientX: 300, clientY: 300 });
    fireEvent.pointerUp(canvas, { pointerId: 2 });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 20, clientY: 20 });
    fireEvent.pointerUp(canvas, { pointerId: 1 });
    expect(onChange.mock.calls[0][0][0].points).toEqual([
      { x: 10, y: 10 },
      { x: 20, y: 20 },
    ]);
  });
});
