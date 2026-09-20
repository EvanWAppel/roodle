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

/** Returns a random word from WORD_LIST, never equal to `exclude` when given. */
export function pickRandomWord(
  exclude?: string,
  rng: () => number = Math.random,
): string {
  const pool = exclude ? WORD_LIST.filter((w) => w !== exclude) : WORD_LIST;
  return pool[Math.floor(rng() * pool.length)];
}
