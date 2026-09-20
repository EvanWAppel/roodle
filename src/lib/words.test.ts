import { describe, it, expect } from 'vitest';
import { WORD_LIST, pickRandomWord } from './words';

describe('words', () => {
  it('has at least 20 unique lowercase single words', () => {
    expect(WORD_LIST.length).toBeGreaterThanOrEqual(20);
    expect(new Set(WORD_LIST).size).toBe(WORD_LIST.length);
    for (const w of WORD_LIST) {
      expect(w).toBe(w.toLowerCase());
      expect(w).not.toMatch(/\s/);
    }
  });

  it('pickRandomWord returns a word from the list', () => {
    for (let i = 0; i < 50; i++) {
      expect(WORD_LIST).toContain(pickRandomWord());
    }
  });

  it('never returns the excluded word', () => {
    const excluded = WORD_LIST[0];
    for (let i = 0; i < 100; i++) {
      expect(pickRandomWord(excluded)).not.toBe(excluded);
    }
  });
});
