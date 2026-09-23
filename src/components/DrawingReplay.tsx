'use client';

import { useCallback, useEffect, useRef } from 'react';
import {
  type Drawing,
  type Point,
  type ReplayStep,
  CANVAS_BG,
  replaySteps,
  finalStepIndex,
} from '@/lib/strokes';

/**
 * Flatten a drawing into the exact order its points are drawn:
 * all of stroke 0's points in order, then stroke 1's, and so on.
 * (Kept for callers/tests; the animation itself uses replaySteps.)
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
 *
 * Controls (GUESS-01):
 *  - "Replay" restarts the animation from the first frame.
 *  - "Show final" cancels the animation and paints the whole drawing at once.
 */
export function DrawingReplay({
  drawing,
  width = 400,
  height = 400,
  onDone,
}: DrawingReplayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  /** Paint every step up to and including `target` (a step index) in one pass. */
  const paintUpTo = useCallback(
    (steps: ReplayStep[], target: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      // jsdom (and older browsers) return null here — never throw on it.
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = CANVAS_BG;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

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
    },
    [],
  );

  const cancel = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const play = useCallback(() => {
    cancel();
    const steps = replaySteps(drawing);

    if (steps.length === 0) {
      paintUpTo(steps, -1); // clears to background
      onDone?.();
      return;
    }

    let i = 0;
    const tick = () => {
      paintUpTo(steps, i);
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
      paintUpTo(steps, steps.length - 1);
      onDone?.();
    }
  }, [drawing, onDone, cancel, paintUpTo]);

  /** Jump to the final frame: stop animating and paint the whole drawing. */
  const showFinal = useCallback(() => {
    cancel();
    const steps = replaySteps(drawing);
    paintUpTo(steps, finalStepIndex(drawing));
    onDone?.();
  }, [drawing, onDone, cancel, paintUpTo]);

  useEffect(() => {
    play();
    return cancel;
  }, [play, cancel]);

  return (
    <div>
      <canvas ref={canvasRef} width={width} height={height} />
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button type="button" onClick={play}>
          Replay
        </button>
        <button type="button" onClick={showFinal}>
          Show final
        </button>
      </div>
    </div>
  );
}

export default DrawingReplay;
