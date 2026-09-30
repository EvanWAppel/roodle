'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type Drawing,
  type Point,
  type Stroke,
  INK_COLORS,
  INK_COLOR_NAMES,
  BRUSH_SIZES,
  CANVAS_BG,
  ERASER_COLOR,
  DEFAULT_INK,
  DEFAULT_BRUSH,
} from '@/lib/strokes';

export interface DrawCanvasProps {
  onChange?: (drawing: Drawing) => void;
  width?: number;
  height?: number;
  initialDrawing?: Drawing;
  disabled?: boolean;
}

const DEFAULT_WIDTH = 400;
const DEFAULT_HEIGHT = 300;

/**
 * DrawCanvas — a pointer-driven drawing surface with color, brush-size, eraser,
 * undo and clear tools. Strokes are recorded as {color, width, points}; the
 * eraser is just a stroke painted in the background color. Coordinates come from
 * getBoundingClientRect() (all zeros under jsdom, so they reduce to clientX/Y).
 */
export function DrawCanvas({
  onChange,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  initialDrawing = [],
  disabled = false,
}: DrawCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState<Drawing>(initialDrawing);
  const [color, setColor] = useState<string>(DEFAULT_INK);
  const [brush, setBrush] = useState<number>(DEFAULT_BRUSH);
  const [eraser, setEraser] = useState(false);
  const activeRef = useRef(false);
  const pointerRef = useRef<number | null>(null);
  // Mirror of the latest drawing so handlers can emit without a stale closure
  // and without calling onChange inside a setState updater (a render-phase
  // side effect that React warns about).
  const drawingRef = useRef<Drawing>(initialDrawing);
  const setDrawingBoth = useCallback((next: Drawing) => {
    drawingRef.current = next;
    setDrawing(next);
  }, []);

  const pointFromEvent = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>): Point => {
      const rect = canvasRef.current?.getBoundingClientRect();
      return {
        x:
          (event.clientX - (rect?.left ?? 0)) *
          (rect?.width ? width / rect.width : 1),
        y:
          (event.clientY - (rect?.top ?? 0)) *
          (rect?.height ? height / rect.height : 1),
      };
    },
    [width, height],
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (disabled || activeRef.current || event.button > 0) return;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      activeRef.current = true;
      pointerRef.current = event.pointerId;
      const point = pointFromEvent(event);
      const stroke: Stroke = {
        color: eraser ? ERASER_COLOR : color,
        width: eraser ? brush * 3 : brush,
        points: [point],
      };
      setDrawingBoth([...drawingRef.current, stroke]);
    },
    [pointFromEvent, eraser, color, brush, setDrawingBoth, disabled],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (!activeRef.current || event.pointerId !== pointerRef.current) return;
      const point = pointFromEvent(event);
      const prev = drawingRef.current;
      if (prev.length === 0) return;
      const current = prev[prev.length - 1];
      const updated: Stroke = {
        ...current,
        points: [...current.points, point],
      };
      setDrawingBoth([...prev.slice(0, -1), updated]);
    },
    [pointFromEvent, setDrawingBoth],
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (!activeRef.current || event.pointerId !== pointerRef.current) return;
      activeRef.current = false;
      pointerRef.current = null;
      onChange?.(drawingRef.current);
    },
    [onChange],
  );

  const handleUndo = useCallback(() => {
    const next = drawingRef.current.slice(0, -1);
    setDrawingBoth(next);
    onChange?.(next);
  }, [onChange, setDrawingBoth]);

  const handleClear = useCallback(() => {
    activeRef.current = false;
    setDrawingBoth([]);
    onChange?.([]);
  }, [onChange, setDrawingBoth]);

  // Paint the white "paper" then each stroke in its own color/width. Guard a
  // null context (jsdom) — never throw.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = CANVAS_BG;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    for (const stroke of drawing) {
      if (stroke.points.length === 0) continue;
      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      if (stroke.points.length === 1)
        ctx.lineTo(stroke.points[0].x + 0.01, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i += 1) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    }
  }, [drawing]);

  return (
    <div className="drawing-workspace">
      <fieldset className="pencil-box" disabled={disabled}>
        <legend className="sr-only">Drawing tools</legend>
        <div className="color-palette" role="group" aria-label="Ink colors">
          {INK_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={INK_COLOR_NAMES[c]}
              aria-pressed={!eraser && color === c}
              onClick={() => {
                setColor(c);
                setEraser(false);
              }}
              className="color-swatch"
              style={{
                backgroundColor: c,
              }}
            />
          ))}
        </div>
        <div
          className="brush-tools"
          role="group"
          aria-label="Brush size and eraser"
        >
          {BRUSH_SIZES.map((b) => (
            <button
              key={b.label}
              type="button"
              aria-label={`brush ${b.label}`}
              aria-pressed={brush === b.width}
              onClick={() => setBrush(b.width)}
              className="tool-button brush-button"
            >
              <span
                aria-hidden="true"
                className="brush-dot"
                style={{ width: b.width + 3, height: b.width + 3 }}
              />
            </button>
          ))}
          <button
            type="button"
            aria-pressed={eraser}
            onClick={() => setEraser((e) => !e)}
            className="tool-button"
          >
            Eraser
          </button>
        </div>
      </fieldset>

      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onLostPointerCapture={handlePointerUp}
        aria-label="Drawing canvas"
        className="drawing-paper"
        style={{
          touchAction: 'none',

          backgroundColor: CANVAS_BG,
        }}
      />

      <div className="canvas-actions">
        <button
          type="button"
          onClick={handleUndo}
          className="tool-button"
          disabled={disabled || drawing.length === 0}
        >
          Undo
        </button>
        <button
          type="button"
          onClick={handleClear}
          className="tool-button"
          disabled={disabled || drawing.length === 0}
        >
          Clear
        </button>
      </div>
    </div>
  );
}

export default DrawCanvas;
