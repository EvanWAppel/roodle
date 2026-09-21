import { describe, it, expect } from 'vitest';
import { RateLimiter } from './rateLimit';

describe('RateLimiter', () => {
  it('allows up to the limit, then blocks', () => {
    const rl = new RateLimiter(3, 1000);
    expect(rl.check('a', 0)).toBe(true);
    expect(rl.check('a', 1)).toBe(true);
    expect(rl.check('a', 2)).toBe(true);
    expect(rl.check('a', 3)).toBe(false);
  });

  it('frees up after the window passes', () => {
    const rl = new RateLimiter(1, 1000);
    expect(rl.check('a', 0)).toBe(true);
    expect(rl.check('a', 500)).toBe(false);
    expect(rl.check('a', 1001)).toBe(true);
  });

  it('tracks keys independently', () => {
    const rl = new RateLimiter(1, 1000);
    expect(rl.check('a', 0)).toBe(true);
    expect(rl.check('b', 0)).toBe(true);
    expect(rl.check('a', 0)).toBe(false);
  });
});
