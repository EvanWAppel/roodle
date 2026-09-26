// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest';
import { CaptureTransport, ConsoleTransport, ResendTransport } from './email';

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

  it('CaptureTransport records invite sends', async () => {
    const t = new CaptureTransport();
    await t.sendInvite({ to: 'x@y.com', url: 'https://x/accept?token=t' });
    expect(t.sentInvites).toEqual([
      { to: 'x@y.com', url: 'https://x/accept?token=t' },
    ]);
  });

  it('ResendTransport sendInvite POSTs to Resend with the recipient + link', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => '' });
    vi.stubGlobal('fetch', fetchMock);

    await new ResendTransport('re_key', 'Roodle <hi@roodle.app>').sendInvite({
      to: 'friend@example.com',
      url: 'https://roodle/api/invites/accept?token=abc',
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.headers.Authorization).toBe('Bearer re_key');
    const body = JSON.parse(init.body);
    expect(body.to).toBe('friend@example.com');
    expect(body.subject).toMatch(/invit/i);
    expect(body.html).toContain('https://roodle/api/invites/accept?token=abc');
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

  // NOTIF-02: turn-nudge emails.
  it('CaptureTransport records nudge sends', async () => {
    const t = new CaptureTransport();
    await t.sendNudge({ to: 'guesser@example.com', url: 'https://x/play?turn=t1' });
    expect(t.sentNudges).toEqual([
      { to: 'guesser@example.com', url: 'https://x/play?turn=t1' },
    ]);
  });

  it('ConsoleTransport.sendNudge does not throw', async () => {
    await expect(
      new ConsoleTransport().sendNudge({
        to: 'guesser@example.com',
        url: 'https://x/play?turn=t1',
      }),
    ).resolves.toBeUndefined();
  });

  it('ResendTransport sendNudge POSTs to Resend with the recipient + deep link', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => '' });
    vi.stubGlobal('fetch', fetchMock);

    await new ResendTransport('re_key', 'Roodle <hi@roodle.app>').sendNudge({
      to: 'guesser@example.com',
      url: 'https://roodle/play?turn=abc',
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.headers.Authorization).toBe('Bearer re_key');
    const body = JSON.parse(init.body);
    expect(body.to).toBe('guesser@example.com');
    expect(body.subject).toMatch(/turn/i);
    expect(body.html).toContain('https://roodle/play?turn=abc');
  });

  it('ResendTransport sendNudge throws on a non-ok response (surfaces, not swallowed)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' }),
    );
    await expect(
      new ResendTransport('re_key', 'x@y.com').sendNudge({
        to: 'a@b.com',
        url: 'u',
      }),
    ).rejects.toThrow(/Resend send failed: 500/);
  });

  it('ResendTransport HTML-escapes the link so a URL cannot break out of the markup', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => '' });
    vi.stubGlobal('fetch', fetchMock);

    // A hostile-looking URL with attribute- and tag-breaking characters.
    const nasty = 'https://x/?a="><script>alert(1)</script>&b=1';
    await new ResendTransport('re_key', 'x@y.com').sendNudge({
      to: 'a@b.com',
      url: nasty,
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    // The raw injection payload must not appear; its escaped form must.
    expect(body.html).not.toContain('"><script>');
    expect(body.html).toContain('&quot;&gt;&lt;script&gt;');
  });
});
