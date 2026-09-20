// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { generateToken, hashToken } from './tokens';

describe('magic-link tokens', () => {
  it('generates distinct, non-trivial tokens', () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(20);
  });

  it('hashes deterministically and hides the raw value', () => {
    const raw = generateToken();
    expect(hashToken(raw)).toBe(hashToken(raw));
    expect(hashToken(raw)).not.toContain(raw);
    expect(hashToken('a')).not.toBe(hashToken('b'));
  });
});
