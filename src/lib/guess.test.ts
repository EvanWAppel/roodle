import { describe, it, expect } from 'vitest';
import {
  normalizeGuess,
  guessMatches,
  buildTileTray,
  isTraySolvable,
} from './guess';

describe('guess logic', () => {
  it('normalizes case and whitespace', () => {
    expect(normalizeGuess('  Ice  Cream  ')).toBe('ice cream');
  });

  it('matches ignoring case and whitespace', () => {
    expect(guessMatches('Cat', ' cat ')).toBe(true);
    expect(guessMatches('cat', 'dog')).toBe(false);
  });

  it('tray contains all word letters plus decoys', () => {
    const seq = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.0, 0.15, 0.25];
    let i = 0;
    const rng = () => seq[i++ % seq.length];
    const tray = buildTileTray('cat', 4, rng);
    expect(tray.length).toBe(3 + 4);
    for (const letter of ['C', 'A', 'T']) {
      expect(tray).toContain(letter);
    }
  });

  it('drops spaces from word letters', () => {
    const tray = buildTileTray('ice cream', 0, () => 0);
    expect(tray.length).toBe('icecream'.length);
    expect(tray).not.toContain(' ');
  });

  it('is solvable: the word can be spelled from a decoy-laden tray (GUESS-02)', () => {
    const seq = [0.1, 0.7, 0.3, 0.9, 0.5, 0.2, 0.8, 0.4, 0.6, 0.05, 0.35, 0.65];
    let i = 0;
    const rng = () => seq[i++ % seq.length];
    const tray = buildTileTray('cat', 4, rng);
    expect(tray.length).toBe(3 + 4); // 4 decoys mixed in
    expect(isTraySolvable('cat', tray)).toBe(true);
  });

  it('isTraySolvable respects duplicate-letter counts', () => {
    expect(isTraySolvable('TOOT', ['T', 'O', 'O', 'T', 'Z'])).toBe(true);
    // Only one O available but the word needs two.
    expect(isTraySolvable('TOOT', ['T', 'O', 'T', 'Z'])).toBe(false);
  });

  it('is deterministic given a seeded rng', () => {
    const mk = () => {
      const seq = [0.42, 0.17, 0.88, 0.05, 0.63, 0.29, 0.9, 0.11];
      let i = 0;
      return () => seq[i++ % seq.length];
    };
    expect(buildTileTray('dog', 3, mk())).toEqual(buildTileTray('dog', 3, mk()));
  });
});
