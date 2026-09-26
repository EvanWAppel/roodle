/**
 * Stroke model: a drawing is an ordered list of strokes; each stroke has a
 * color and width plus its ordered points. Eraser strokes are just strokes
 * painted in the canvas background color.
 */
export interface Point {
  x: number;
  y: number;
}

export interface Stroke {
  color: string;
  width: number;
  points: Point[];
}

export type Drawing = Stroke[];

/** Ink palette offered by the drawing tools. */
export const INK_COLORS = [
  '#111827', // ink
  '#ef4444', // red
  '#f59e0b', // amber
  '#22c55e', // green
  '#3b82f6', // blue
  '#a855f7', // purple
] as const;

/** Brush sizes (stroke widths in px). */
export const BRUSH_SIZES = [
  { label: 'S', width: 2 },
  { label: 'M', width: 4 },
  { label: 'L', width: 8 },
] as const;

export const CANVAS_BG = '#ffffff';
/** Eraser paints the background color over existing strokes. */
export const ERASER_COLOR = CANVAS_BG;
export const DEFAULT_INK = INK_COLORS[0];
export const DEFAULT_BRUSH = BRUSH_SIZES[1].width;

/**
 * Size budget for a submitted drawing (PRD TQ4).
 *
 * Strokes are persisted as JSON in the turns table, so an unbounded payload is
 * both a storage-abuse and a DoS vector now that the endpoint is live. These
 * caps are generous for real human drawings on a touch/mouse canvas but keep
 * any single turn bounded:
 *
 * - MAX_STROKES (2000): a busy, detailed doodle is a few hundred strokes; 2000
 *   leaves comfortable headroom without letting a payload balloon.
 * - MAX_POINTS_PER_STROKE (5000): a single long, dense drag samples at most a
 *   few thousand points; 5000 covers the worst realistic stroke.
 * - MAX_TOTAL_POINTS (100000): the overall ceiling. At ~2 numbers/point this is
 *   ~200k coordinates — a few MB of JSON worst case — which bounds storage and
 *   parse cost while still fitting any plausible drawing.
 */
export const MAX_STROKES = 2000;
export const MAX_POINTS_PER_STROKE = 5000;
export const MAX_TOTAL_POINTS = 100_000;

/** Result of validating an untrusted value against the {@link Drawing} shape. */
export type ValidateDrawingResult =
  | { ok: true; drawing: Drawing }
  | { ok: false; error: string };

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPoint(value: unknown): value is Point {
  if (typeof value !== 'object' || value === null) return false;
  const { x, y } = value as Record<string, unknown>;
  return isFiniteNumber(x) && isFiniteNumber(y);
}

/**
 * Validate an untrusted value against the {@link Drawing} shape and the size
 * budget above. Pure — no side effects, no throwing — so both the API route and
 * tests can share it. Returns the typed drawing on success or a clear reason on
 * failure (errors are surfaced, never swallowed).
 */
export function validateDrawing(value: unknown): ValidateDrawingResult {
  if (!Array.isArray(value)) {
    return { ok: false, error: 'strokes must be an array' };
  }
  if (value.length > MAX_STROKES) {
    return {
      ok: false,
      error: `too many strokes (max ${MAX_STROKES})`,
    };
  }

  let totalPoints = 0;
  for (let i = 0; i < value.length; i++) {
    const stroke = value[i];
    if (typeof stroke !== 'object' || stroke === null) {
      return { ok: false, error: `stroke ${i} is not an object` };
    }
    const { color, width, points } = stroke as Record<string, unknown>;
    if (typeof color !== 'string') {
      return { ok: false, error: `stroke ${i} has a non-string color` };
    }
    if (!isFiniteNumber(width) || width <= 0) {
      return {
        ok: false,
        error: `stroke ${i} has a non-positive or non-finite width`,
      };
    }
    if (!Array.isArray(points)) {
      return { ok: false, error: `stroke ${i} points is not an array` };
    }
    if (points.length > MAX_POINTS_PER_STROKE) {
      return {
        ok: false,
        error: `stroke ${i} has too many points (max ${MAX_POINTS_PER_STROKE})`,
      };
    }
    totalPoints += points.length;
    if (totalPoints > MAX_TOTAL_POINTS) {
      return {
        ok: false,
        error: `too many total points (max ${MAX_TOTAL_POINTS})`,
      };
    }
    for (let j = 0; j < points.length; j++) {
      if (!isPoint(points[j])) {
        return {
          ok: false,
          error: `stroke ${i} point ${j} is not {x:number, y:number} with finite coords`,
        };
      }
    }
  }

  return { ok: true, drawing: value as Drawing };
}
