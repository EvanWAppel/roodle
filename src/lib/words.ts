/** SLICE-02: minimal built-in word list. WORD group later replaces this with DB packs. */
export const WORD_LIST: string[] = [
  'cat',
  'dog',
  'house',
  'tree',
  'sun',
  'moon',
  'star',
  'boat',
  'car',
  'fish',
  'bird',
  'flower',
  'apple',
  'banana',
  'clock',
  'chair',
  'guitar',
  'rocket',
  'robot',
  'ghost',
  'snake',
  'ladder',
  'balloon',
  'umbrella',
  'pizza',
  'mountain',
  'river',
  'bridge',
  'castle',
  'rainbow',
];

/**
 * Returns a random word from `list` (defaults to WORD_LIST), never equal to
 * `exclude` when given. Pure and reusable — DB-backed pack selection passes in
 * the eligible words from enabled packs (see src/db/packs.ts).
 */
export function pickRandomWord(
  list: readonly string[] = WORD_LIST,
  exclude?: string,
  rng: () => number = Math.random,
): string {
  const pool = exclude ? list.filter((w) => w !== exclude) : list;
  return pool[Math.floor(rng() * pool.length)];
}
