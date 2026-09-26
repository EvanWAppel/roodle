import { describe, it, expect, afterEach, vi } from 'vitest';
import { resolveBaseUrl } from './baseUrl';

function req(url: string, headers: Record<string, string> = {}): Request {
  return new Request(url, { headers });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('resolveBaseUrl', () => {
  it('prefers APP_URL over everything, stripping a trailing slash', () => {
    vi.stubEnv('APP_URL', 'https://roodle.example.com/');
    const base = resolveBaseUrl(
      req('http://localhost:8080/api/x', {
        'x-forwarded-host': 'evil.example',
        'x-forwarded-proto': 'http',
      }),
    );
    expect(base).toBe('https://roodle.example.com');
  });

  it('uses x-forwarded-host + proto when APP_URL is unset (proxy case)', () => {
    vi.stubEnv('APP_URL', '');
    const base = resolveBaseUrl(
      req('http://localhost:8080/api/x', {
        'x-forwarded-host': 'roodle-web-production.up.railway.app',
        'x-forwarded-proto': 'https',
      }),
    );
    expect(base).toBe('https://roodle-web-production.up.railway.app');
  });

  it('defaults the forwarded proto to https when only the host is present', () => {
    vi.stubEnv('APP_URL', '');
    const base = resolveBaseUrl(
      req('http://localhost:8080/api/x', {
        'x-forwarded-host': 'roodle.up.railway.app',
      }),
    );
    expect(base).toBe('https://roodle.up.railway.app');
  });

  it('takes the first host when the forwarded header is a list', () => {
    vi.stubEnv('APP_URL', '');
    const base = resolveBaseUrl(
      req('http://localhost:8080/api/x', {
        'x-forwarded-host': 'real.example, inner.internal',
        'x-forwarded-proto': 'https, http',
      }),
    );
    expect(base).toBe('https://real.example');
  });

  it('falls back to the request origin when no APP_URL or forwarded host (local dev)', () => {
    vi.stubEnv('APP_URL', '');
    const base = resolveBaseUrl(req('http://localhost:3000/api/x'));
    expect(base).toBe('http://localhost:3000');
  });
});
