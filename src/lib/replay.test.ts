import { describe, it, expect } from 'vitest';
import type { Drawing } from './strokes';
import { replaySteps, replayStepCount, finalStepIndex } from './strokes';

/**
 * GUESS-01 replay-model tests. The canvas replay animates over these pure steps,
 * so testing them establishes that replay visits every point in draw order and
 * that "jump to final" seeks to the last frame — without touching canvas pixels.
 */
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

describe('replaySteps', () => {
  it('visits every point in stroke-then-point (draw) order', () => {
    const steps = replaySteps(drawing);
    expect(steps.map((s) => s.point)).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 3 },
      { x: 4, y: 4 },
    ]);
  });

  it('flags only the first point of each stroke as startsStroke and carries stroke style', () => {
    const steps = replaySteps(drawing);
    expect(steps.map((s) => s.startsStroke)).toEqual([true, false, true, false, false]);
    expect(steps[0].color).toBe('#111827');
    expect(steps[0].width).toBe(4);
    expect(steps[2].color).toBe('#ef4444');
    expect(steps[2].width).toBe(2);
  });

  it('returns no steps for an empty drawing', () => {
    expect(replaySteps([])).toEqual([]);
  });
});

describe('replayStepCount / finalStepIndex', () => {
  it('counts all points across strokes', () => {
    expect(replayStepCount(drawing)).toBe(5);
  });

  it('final index is the last reachable frame', () => {
    // Jump-to-final seeks here; drawing up to it shows the whole drawing.
    expect(finalStepIndex(drawing)).toBe(4);
    expect(finalStepIndex(drawing)).toBe(replaySteps(drawing).length - 1);
  });

  it('final index is -1 for an empty drawing (nothing to show)', () => {
    expect(replayStepCount([])).toBe(0);
    expect(finalStepIndex([])).toBe(-1);
  });
});
