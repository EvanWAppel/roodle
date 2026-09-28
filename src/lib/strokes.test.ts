import { describe, it, expect, vi } from 'vitest';
import {
  validateDrawing,
  renderDrawing,
  MAX_STROKES,
  MAX_POINTS_PER_STROKE,
  MAX_TOTAL_POINTS,
  MAX_COLOR_LENGTH,
  MAX_WIDTH,
} from './strokes';
import type { Drawing } from './strokes';

function mockCtx() {
  return {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    lineCap: '',
    lineJoin: '',
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
  };
}

describe('renderDrawing', () => {
  it('clears the background then strokes each non-empty path once', () => {
    const drawing: Drawing = [
      { color: '#111827', width: 4, points: [{ x: 0, y: 0 }, { x: 5, y: 5 }] },
      { color: '#ef4444', width: 2, points: [{ x: 9, y: 9 }] }, // dot
      { color: '#22c55e', width: 3, points: [] }, // skipped
    ];
    const ctx = mockCtx();
    renderDrawing(ctx as unknown as CanvasRenderingContext2D, drawing, 400, 300);

    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 400, 300);
    // Two non-empty strokes → two paths.
    expect(ctx.stroke).toHaveBeenCalledTimes(2);
    expect(ctx.moveTo).toHaveBeenCalledWith(0, 0);
    // The lone-point stroke draws a tiny segment so its round cap shows.
    expect(ctx.lineTo).toHaveBeenCalledWith(9.01, 9);
  });

  it('renders an empty drawing as just a cleared background', () => {
    const ctx = mockCtx();
    renderDrawing(ctx as unknown as CanvasRenderingContext2D, [], 100, 100);
    expect(ctx.fillRect).toHaveBeenCalledOnce();
    expect(ctx.stroke).not.toHaveBeenCalled();
  });
});

const validStroke = {
  color: '#111827',
  width: 4,
  points: [
    { x: 0, y: 0 },
    { x: 10, y: 10 },
  ],
};

describe('validateDrawing', () => {
  it('accepts a well-formed drawing', () => {
    const result = validateDrawing([validStroke]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.drawing).toHaveLength(1);
      expect(result.drawing[0].points).toHaveLength(2);
    }
  });

  it('accepts an empty drawing (no strokes)', () => {
    const result = validateDrawing([]);
    expect(result.ok).toBe(true);
  });

  it('rejects a non-array top level', () => {
    for (const bad of [null, undefined, {}, 'strokes', 42, true]) {
      const result = validateDrawing(bad);
      expect(result.ok).toBe(false);
    }
  });

  it('rejects a stroke that is not an object', () => {
    expect(validateDrawing(['nope']).ok).toBe(false);
    expect(validateDrawing([null]).ok).toBe(false);
    expect(validateDrawing([42]).ok).toBe(false);
  });

  it('rejects a stroke with a non-string color', () => {
    expect(validateDrawing([{ ...validStroke, color: 123 }]).ok).toBe(false);
    expect(validateDrawing([{ ...validStroke, color: null }]).ok).toBe(false);
    expect(
      validateDrawing([{ width: 4, points: validStroke.points }]).ok,
    ).toBe(false);
  });

  it('rejects a stroke with a non-positive or NaN width', () => {
    expect(validateDrawing([{ ...validStroke, width: 0 }]).ok).toBe(false);
    expect(validateDrawing([{ ...validStroke, width: -1 }]).ok).toBe(false);
    expect(validateDrawing([{ ...validStroke, width: NaN }]).ok).toBe(false);
    expect(
      validateDrawing([{ ...validStroke, width: Infinity }]).ok,
    ).toBe(false);
    expect(validateDrawing([{ ...validStroke, width: '4' }]).ok).toBe(false);
  });

  it('rejects a stroke whose points is not an array', () => {
    expect(validateDrawing([{ ...validStroke, points: 'x' }]).ok).toBe(false);
    expect(validateDrawing([{ ...validStroke, points: null }]).ok).toBe(false);
  });

  it('rejects a point that is not an object with numeric coords', () => {
    expect(
      validateDrawing([{ ...validStroke, points: [{ x: 0 }] }]).ok,
    ).toBe(false);
    expect(
      validateDrawing([{ ...validStroke, points: [{ x: 0, y: 'a' }] }]).ok,
    ).toBe(false);
    expect(
      validateDrawing([{ ...validStroke, points: ['nope'] }]).ok,
    ).toBe(false);
  });

  it('rejects a point with non-finite coords', () => {
    expect(
      validateDrawing([{ ...validStroke, points: [{ x: NaN, y: 0 }] }]).ok,
    ).toBe(false);
    expect(
      validateDrawing([{ ...validStroke, points: [{ x: 0, y: Infinity }] }])
        .ok,
    ).toBe(false);
    expect(
      validateDrawing([
        { ...validStroke, points: [{ x: -Infinity, y: 0 }] },
      ]).ok,
    ).toBe(false);
  });

  it('rejects too many strokes (over MAX_STROKES)', () => {
    const tooMany = Array.from({ length: MAX_STROKES + 1 }, () => ({
      color: '#111827',
      width: 4,
      points: [{ x: 0, y: 0 }],
    }));
    const result = validateDrawing(tooMany);
    expect(result.ok).toBe(false);
  });

  it('accepts exactly MAX_STROKES strokes', () => {
    const atLimit = Array.from({ length: MAX_STROKES }, () => ({
      color: '#111827',
      width: 4,
      points: [{ x: 0, y: 0 }],
    }));
    expect(validateDrawing(atLimit).ok).toBe(true);
  });

  it('rejects too many points in a single stroke', () => {
    const bigStroke = {
      color: '#111827',
      width: 4,
      points: Array.from({ length: MAX_POINTS_PER_STROKE + 1 }, () => ({
        x: 1,
        y: 1,
      })),
    };
    expect(validateDrawing([bigStroke]).ok).toBe(false);
  });

  it('rejects too many total points across strokes', () => {
    // Each stroke is within per-stroke cap, but together they blow the total.
    const perStroke = MAX_POINTS_PER_STROKE;
    const strokeCount = Math.ceil(MAX_TOTAL_POINTS / perStroke) + 1;
    const strokes = Array.from({ length: strokeCount }, () => ({
      color: '#111827',
      width: 4,
      points: Array.from({ length: perStroke }, () => ({ x: 1, y: 1 })),
    }));
    // Guard: ensure this case actually exceeds the total-points cap without
    // tripping the stroke-count cap first.
    expect(strokes.length).toBeLessThanOrEqual(MAX_STROKES);
    expect(validateDrawing(strokes).ok).toBe(false);
  });

  it('rejects an over-long color string (payload-size abuse via a scalar field)', () => {
    // One stroke, zero points — sails past every point-based cap — but a giant
    // color string would still balloon the persisted JSON.
    const stroke = {
      color: 'x'.repeat(MAX_COLOR_LENGTH + 1),
      width: 4,
      points: [],
    };
    expect(validateDrawing([stroke]).ok).toBe(false);
  });

  it('accepts a color exactly at the length cap', () => {
    const stroke = {
      color: '#'.padEnd(MAX_COLOR_LENGTH, 'a'),
      width: 4,
      points: [{ x: 0, y: 0 }],
    };
    expect(validateDrawing([stroke]).ok).toBe(true);
  });

  it('rejects an absurdly large width', () => {
    const stroke = { color: '#111827', width: MAX_WIDTH + 1, points: [] };
    expect(validateDrawing([stroke]).ok).toBe(false);
  });
});
