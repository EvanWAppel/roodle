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

  it('correct letters are a sub-multiset of the tray (solvable with decoys mixed in)', () => {
    // Use a word with a repeated letter to prove multiplicity is preserved,
    // not just letter presence: "LEVEL" needs two L's and two E's.
    const seq = [0.3, 0.7, 0.1, 0.9, 0.5, 0.2, 0.8, 0.4, 0.6, 0.05, 0.95, 0.15];
    let i = 0;
    const rng = () => seq[i++ % seq.length];
    const word = 'level';
    const decoyCount = 5;
    const tray = buildTileTray(word, decoyCount, rng);

    const needed = word.toUpperCase().replace(/\s+/g, '').split('');
    expect(tray.length).toBe(needed.length + decoyCount);

    // Every correct letter must be removable from a working copy of the tray,
    // i.e. the answer's letter counts are all present with at least equal count.
    const remaining = tray.slice();
    for (const letter of needed) {
      const at = remaining.indexOf(letter);
      expect(at).toBeGreaterThanOrEqual(0);
      remaining.splice(at, 1);
    }
    // Exactly the decoys are left over.
    expect(remaining.length).toBe(decoyCount);
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
