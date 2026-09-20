'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type Drawing,
  type Point,
  type Stroke,
  INK_COLORS,
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
}: DrawCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState<Drawing>([]);
  const [color, setColor] = useState<string>(DEFAULT_INK);
  const [brush, setBrush] = useState<number>(DEFAULT_BRUSH);
  const [eraser, setEraser] = useState(false);
  const activeRef = useRef(false);
  // Mirror of the latest drawing so handlers can emit without a stale closure
  // and without calling onChange inside a setState updater (a render-phase
  // side effect that React warns about).
  const drawingRef = useRef<Drawing>([]);
  const setDrawingBoth = useCallback((next: Drawing) => {
    drawingRef.current = next;
    setDrawing(next);
  }, []);

  const pointFromEvent = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>): Point => {
      const rect = canvasRef.current?.getBoundingClientRect();
      return {
        x: event.clientX - (rect?.left ?? 0),
        y: event.clientY - (rect?.top ?? 0),
      };
    },
    [],
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      activeRef.current = true;
      const point = pointFromEvent(event);
      const stroke: Stroke = {
        color: eraser ? ERASER_COLOR : color,
        width: eraser ? brush * 3 : brush,
        points: [point],
      };
      setDrawingBoth([...drawingRef.current, stroke]);
    },
    [pointFromEvent, eraser, color, brush, setDrawingBoth],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (!activeRef.current) return;
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

  const handlePointerUp = useCallback(() => {
    if (!activeRef.current) return;
    activeRef.current = false;
    onChange?.(drawingRef.current);
  }, [onChange]);

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
      for (let i = 1; i < stroke.points.length; i += 1) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    }
  }, [drawing]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {INK_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`color ${c}`}
            aria-pressed={!eraser && color === c}
            onClick={() => {
              setColor(c);
              setEraser(false);
            }}
            className="h-6 w-6 rounded-full border"
            style={{
              backgroundColor: c,
              outline: !eraser && color === c ? '2px solid #000' : 'none',
            }}
          />
        ))}
        <span className="mx-1 h-5 w-px bg-gray-300" />
        {BRUSH_SIZES.map((b) => (
          <button
            key={b.label}
            type="button"
            aria-label={`brush ${b.label}`}
            aria-pressed={brush === b.width}
            onClick={() => setBrush(b.width)}
            className={`rounded border px-2 py-1 text-xs ${
              brush === b.width ? 'bg-black text-white' : 'bg-white'
            }`}
          >
            {b.label}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={eraser}
          onClick={() => setEraser((e) => !e)}
          className={`rounded border px-2 py-1 text-xs ${
            eraser ? 'bg-black text-white' : 'bg-white'
          }`}
        >
          Eraser
        </button>
      </div>

      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{
          touchAction: 'none',
          border: '1px solid #d1d5db',
          borderRadius: 6,
          backgroundColor: CANVAS_BG,
        }}
      />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleUndo}
          className="rounded border px-3 py-1 text-sm"
        >
          Undo
        </button>
        <button
          type="button"
          onClick={handleClear}
          className="rounded border px-3 py-1 text-sm"
        >
          Clear
        </button>
      </div>
    </div>
  );
}

export default DrawCanvas;
