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
 * One drawing step: a single point plus the stroke context needed to paint it
 * (its color/width and whether it begins a new stroke, so the pen lifts between
 * strokes). This is the pure model the canvas replay animates over — flattening
 * the drawing this way lets us test replay ordering without touching canvas.
 */
export interface ReplayStep {
  point: Point;
  startsStroke: boolean;
  color: string;
  width: number;
}

/**
 * Flatten a drawing into ordered replay steps: every point of stroke 0 in order,
 * then stroke 1's, and so on. The first point of each stroke is flagged
 * `startsStroke` so the renderer knows to lift the pen (moveTo, not lineTo).
 */
export function replaySteps(drawing: Drawing): ReplayStep[] {
  const steps: ReplayStep[] = [];
  for (const stroke of drawing) {
    stroke.points.forEach((point, index) => {
      steps.push({
        point,
        startsStroke: index === 0,
        color: stroke.color,
        width: stroke.width,
      });
    });
  }
  return steps;
}

/** Total number of replay steps (frames) a drawing animates through. */
export function replayStepCount(drawing: Drawing): number {
  let n = 0;
  for (const stroke of drawing) n += stroke.points.length;
  return n;
}

/**
 * The step index of the final frame — the last index the animation reaches, and
 * the index "jump to final" seeks to so the whole drawing is shown at once.
 * Returns -1 for an empty drawing (no frames to show).
 */
export function finalStepIndex(drawing: Drawing): number {
  return replayStepCount(drawing) - 1;
}
