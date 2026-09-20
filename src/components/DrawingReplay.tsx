'use client';

import { useCallback, useEffect, useRef } from 'react';
import { type Drawing, type Point, CANVAS_BG } from '@/lib/strokes';

/**
 * Flatten a drawing into the exact order its points are drawn:
 * all of stroke 0's points in order, then stroke 1's, and so on.
 */
export function orderedPoints(drawing: Drawing): Point[] {
  const points: Point[] = [];
  for (const stroke of drawing) {
    for (const point of stroke.points) {
      points.push(point);
    }
  }
  return points;
}

export interface DrawingReplayProps {
  drawing: Drawing;
  width?: number;
  height?: number;
  onDone?: () => void;
}

/**
 * Replays a submitted drawing by progressively animating its strokes onto a
 * canvas in the exact order they were drawn, so a guesser watches it appear.
 */
export function DrawingReplay({
  drawing,
  width = 400,
  height = 400,
  onDone,
}: DrawingReplayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const play = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // jsdom (and older browsers) return null here — never throw on it.
    const ctx = canvas.getContext('2d');

    // Cancel any in-flight animation before restarting.
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (ctx) {
      ctx.fillStyle = CANVAS_BG;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }

    // Flatten points but keep, per point, its stroke's color/width and whether
    // it begins a stroke (so we lift the pen between strokes).
    type Step = {
      point: Point;
      startsStroke: boolean;
      color: string;
      width: number;
    };
    const steps: Step[] = [];
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

    if (steps.length === 0) {
      onDone?.();
      return;
    }

    let i = 0;

    const drawUpTo = (target: number) => {
      if (!ctx) return;
      ctx.fillStyle = CANVAS_BG;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const limit = Math.min(target, steps.length - 1);
      let k = 0;
      while (k <= limit) {
        const seg = steps[k];
        ctx.beginPath();
        ctx.strokeStyle = seg.color;
        ctx.lineWidth = seg.width;
        ctx.moveTo(seg.point.x, seg.point.y);
        let j = k + 1;
        while (j <= limit && !steps[j].startsStroke) {
          ctx.lineTo(steps[j].point.x, steps[j].point.y);
          j++;
        }
        ctx.stroke();
        k = j;
      }
    };

    const tick = () => {
      drawUpTo(i);
      i++;
      if (i < steps.length) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
        onDone?.();
      }
    };

    if (typeof requestAnimationFrame === 'function') {
      rafRef.current = requestAnimationFrame(tick);
    } else {
      // Fallback: draw everything at once.
      drawUpTo(steps.length - 1);
      onDone?.();
    }
  }, [drawing, onDone]);

  useEffect(() => {
    play();
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [play]);

  return (
    <div>
      <canvas ref={canvasRef} width={width} height={height} />
      <div>
        <button type="button" onClick={play}>
          Replay
        </button>
      </div>
    </div>
  );
}

export default DrawingReplay;
