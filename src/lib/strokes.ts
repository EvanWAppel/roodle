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
