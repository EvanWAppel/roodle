import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  fetchSession,
  submitTurn,
  fetchPending,
  submitGuess,
  giveUp,
} from './api';

function mockFetch(body: unknown, ok = true, status = 200) {
  const fn = vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => body,
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe('client api helpers', () => {
  it('fetchSession hits the session route with the actor', async () => {
    const fn = mockFetch({ me: { id: '1' } });
    await fetchSession('christine');
    expect(fn).toHaveBeenCalledWith('/api/session?as=christine');
  });

  it('submitTurn POSTs the drawing payload', async () => {
    const fn = mockFetch({ id: 't1' });
    await submitTurn({
      gameId: 'g',
      drawerId: 'a',
      guesserId: 'b',
      word: 'cat',
      strokes: [],
    });
    const [url, init] = fn.mock.calls[0];
    expect(url).toBe('/api/turns');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body).word).toBe('cat');
  });

  it('fetchPending queries by guesser id', async () => {
    const fn = mockFetch([]);
    await fetchPending('b');
    expect(fn).toHaveBeenCalledWith('/api/turns?for=b');
  });

  it('submitGuess posts the guess to the turn', async () => {
    const fn = mockFetch({ status: 'guessed' });
    await submitGuess('t1', 'cat');
    const [url, init] = fn.mock.calls[0];
    expect(url).toBe('/api/turns/t1/guess');
    expect(JSON.parse(init.body)).toEqual({ guess: 'cat' });
  });

  it('giveUp posts the give_up action', async () => {
    const fn = mockFetch({ status: 'gave_up' });
    await giveUp('t1');
    expect(JSON.parse(fn.mock.calls[0][1].body)).toEqual({ action: 'give_up' });
  });

  it('throws on a non-ok response', async () => {
    mockFetch({}, false, 500);
    await expect(fetchPending('b')).rejects.toThrow(/500/);
  });
});
