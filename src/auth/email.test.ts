// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest';
import { CaptureTransport, ResendTransport } from './email';

afterEach(() => vi.unstubAllGlobals());

describe('email transports', () => {
  it('CaptureTransport records what would be sent', async () => {
    const t = new CaptureTransport();
    await t.sendMagicLink({ to: 'a@b.com', url: 'https://x/cb?token=t' });
    expect(t.sent).toEqual([{ to: 'a@b.com', url: 'https://x/cb?token=t' }]);
  });

  it('ResendTransport POSTs to the Resend API with auth + recipient', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => '' });
    vi.stubGlobal('fetch', fetchMock);

    await new ResendTransport('re_key', 'Roodle <hi@roodle.app>').sendMagicLink({
      to: 'christine@example.com',
      url: 'https://roodle/cb?token=abc',
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.headers.Authorization).toBe('Bearer re_key');
    const body = JSON.parse(init.body);
    expect(body.to).toBe('christine@example.com');
    expect(body.from).toContain('roodle.app');
    expect(body.html).toContain('https://roodle/cb?token=abc');
  });

  it('ResendTransport throws on a non-ok response (no silent failure)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 422, text: async () => 'bad' }),
    );
    await expect(
      new ResendTransport('re_key', 'x@y.com').sendMagicLink({
        to: 'a@b.com',
        url: 'u',
      }),
    ).rejects.toThrow(/Resend send failed: 422/);
  });
});
