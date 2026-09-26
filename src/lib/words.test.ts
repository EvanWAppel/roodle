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

  it('pickRandomWord defaults to WORD_LIST', () => {
    for (let i = 0; i < 50; i++) {
      expect(WORD_LIST).toContain(pickRandomWord());
    }
  });

  it('pickRandomWord returns a word from a supplied list', () => {
    const list = ['alpha', 'beta', 'gamma'];
    for (let i = 0; i < 50; i++) {
      expect(list).toContain(pickRandomWord(list));
    }
  });

  it('never returns the excluded word', () => {
    const excluded = WORD_LIST[0];
    for (let i = 0; i < 100; i++) {
      expect(pickRandomWord(WORD_LIST, excluded)).not.toBe(excluded);
    }
  });

  it('excludes from a supplied list too', () => {
    const list = ['a', 'b', 'c'];
    for (let i = 0; i < 100; i++) {
      expect(pickRandomWord(list, 'a')).not.toBe('a');
    }
  });
});
