// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  createSessionToken,
  verifySessionToken,
  SESSION_MAX_AGE_S,
} from './session';

describe('session tokens', () => {
  it('round-trips a user id', () => {
    const t = createSessionToken('user-123');
    expect(verifySessionToken(t)).toBe('user-123');
  });

  it('rejects a tampered payload', () => {
    const t = createSessionToken('user-123');
    const [, sig] = t.split('.');
    const forged =
      Buffer.from(JSON.stringify({ uid: 'someone-else', iat: Date.now() })).toString(
        'base64url',
      ) +
      '.' +
      sig;
    expect(verifySessionToken(forged)).toBeNull();
  });

  it('rejects malformed / empty tokens', () => {
    expect(verifySessionToken(undefined)).toBeNull();
    expect(verifySessionToken('')).toBeNull();
    expect(verifySessionToken('nope')).toBeNull();
  });

  it('rejects an expired token', () => {
    const old = Date.now() - (SESSION_MAX_AGE_S + 60) * 1000;
    expect(verifySessionToken(createSessionToken('user-123', old))).toBeNull();
  });
});
