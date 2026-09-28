import { render, screen } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import type { Drawing } from '@/lib/strokes';
import { DrawingThumbnail } from './DrawingThumbnail';

afterEach(() => vi.restoreAllMocks());

const drawing: Drawing = [
  { color: '#111827', width: 4, points: [{ x: 0, y: 0 }, { x: 10, y: 10 }] },
];

describe('DrawingThumbnail', () => {
  it('renders a labelled image', () => {
    render(<DrawingThumbnail drawing={drawing} label="Drawing of cat" />);
    expect(screen.getByRole('img', { name: 'Drawing of cat' })).toBeInTheDocument();
  });

  it('does not throw when the canvas 2d context is null (jsdom)', () => {
    expect(() =>
      render(<DrawingThumbnail drawing={drawing} label="Drawing of dog" />),
    ).not.toThrow();
  });
});
