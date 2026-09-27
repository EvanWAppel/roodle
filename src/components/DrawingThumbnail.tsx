'use client';

import { useEffect, useRef } from 'react';
import { type Drawing, renderDrawing } from '@/lib/strokes';

export interface DrawingThumbnailProps {
  drawing: Drawing;
  /** Label for the image, e.g. "Drawing of cat". */
  label: string;
}

/**
 * A static, non-interactive thumbnail of a completed drawing (DESIGN-10 /
 * reconciles DRAW-07). Renders only the final frame from the stored strokes — no
 * animation, no controls — so a grid of many drawings stays cheap. The backing
 * store matches the replay's coordinate space (400×300); CSS scales it into the
 * gallery tile.
 */
export function DrawingThumbnail({ drawing, label }: DrawingThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // jsdom (and very old browsers) return null — never throw on it.
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    renderDrawing(ctx, drawing, canvas.width, canvas.height);
  }, [drawing]);

  return (
    <canvas
      className="gallery-thumb"
      ref={canvasRef}
      width={400}
      height={300}
      role="img"
      aria-label={label}
    />
  );
}

export default DrawingThumbnail;
