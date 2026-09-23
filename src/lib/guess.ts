/**
 * SLICE-09 guessing logic (pure). GUESS group later extends with hints etc.
 */

/** Lowercase, trim, and collapse internal whitespace so guesses are compared loosely. */
export function normalizeGuess(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** True when guess equals the word ignoring case and surrounding/inner whitespace. */
export function guessMatches(word: string, guess: string): boolean {
  return normalizeGuess(word) === normalizeGuess(guess);
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Build the tile tray for a word: its letters (uppercase, spaces dropped) plus
 * `decoyCount` random decoy letters, shuffled. Deterministic when `rng` is given.
 */
export function buildTileTray(
  word: string,
  decoyCount = 4,
  rng: () => number = Math.random,
): string[] {
  const letters = word
    .toUpperCase()
    .replace(/\s+/g, '')
    .split('');
  const decoys = Array.from({ length: decoyCount }, () =>
    ALPHABET[Math.floor(rng() * ALPHABET.length)],
  );
  const tray = [...letters, ...decoys];
  // Fisher–Yates shuffle using rng.
  for (let i = tray.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [tray[i], tray[j]] = [tray[j], tray[i]];
  }
  return tray;
}

/**
 * True when `word` can be spelled from `tray` — every letter of the word
 * (uppercased, spaces dropped) has a distinct tile available, counting
 * duplicates. Guarantees a decoy-laden tray is still solvable.
 */
export function isTraySolvable(word: string, tray: string[]): boolean {
  const need = new Map<string, number>();
  for (const ch of word.toUpperCase().replace(/\s+/g, '')) {
    need.set(ch, (need.get(ch) ?? 0) + 1);
  }
  const have = new Map<string, number>();
  for (const ch of tray) {
    have.set(ch, (have.get(ch) ?? 0) + 1);
  }
  for (const [ch, count] of need) {
    if ((have.get(ch) ?? 0) < count) return false;
  }
  return true;
}
