/**
 * Fixture for the signed-out sample round (DESIGN-11). This is clearly-labeled
 * demo artwork — NOT a real game turn. Nothing here reads or writes private data,
 * and the sample round that uses it makes no network calls, so no real user is
 * implied and no email/game write can happen. Coordinates live in the same
 * 400×300 space the replay renders in.
 */
import type { Drawing } from './strokes';

const INK = '#111827';

/** A simple house doodle: walls, roof, door — guessable as "house". */
export const SAMPLE_DRAWING: Drawing = [
  // Walls (a closed square).
  {
    color: INK,
    width: 5,
    points: [
      { x: 130, y: 190 },
      { x: 270, y: 190 },
      { x: 270, y: 100 },
      { x: 130, y: 100 },
      { x: 130, y: 190 },
    ],
  },
  // Roof.
  {
    color: INK,
    width: 5,
    points: [
      { x: 130, y: 100 },
      { x: 200, y: 55 },
      { x: 270, y: 100 },
    ],
  },
  // Door.
  {
    color: INK,
    width: 4,
    points: [
      { x: 185, y: 190 },
      { x: 185, y: 140 },
      { x: 215, y: 140 },
      { x: 215, y: 190 },
    ],
  },
];

export const SAMPLE_WORD = 'house';
