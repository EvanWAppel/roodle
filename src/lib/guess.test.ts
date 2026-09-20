import { describe, it, expect } from 'vitest';
import { normalizeGuess, guessMatches, buildTileTray } from './guess';

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

  it('is deterministic given a seeded rng', () => {
    const mk = () => {
      const seq = [0.42, 0.17, 0.88, 0.05, 0.63, 0.29, 0.9, 0.11];
      let i = 0;
      return () => seq[i++ % seq.length];
    };
    expect(buildTileTray('dog', 3, mk())).toEqual(buildTileTray('dog', 3, mk()));
  });
});
