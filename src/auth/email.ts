export interface MagicLinkEmail {
  to: string;
  url: string;
}

export interface EmailTransport {
  sendMagicLink(msg: MagicLinkEmail): Promise<void>;
}

/** Test transport: records what would have been sent. */
export class CaptureTransport implements EmailTransport {
  readonly sent: MagicLinkEmail[] = [];
  async sendMagicLink(msg: MagicLinkEmail): Promise<void> {
    this.sent.push(msg);
  }
}

/** Fallback transport (dev, or prod before a provider is configured): log it. */
export class ConsoleTransport implements EmailTransport {
  async sendMagicLink(msg: MagicLinkEmail): Promise<void> {
    console.log(`[roodle] magic link for ${msg.to}: ${msg.url}`);
  }
}

/** Sends via the Resend REST API (no SDK dependency). Throws on failure. */
export class ResendTransport implements EmailTransport {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async sendMagicLink({ to, url }: MagicLinkEmail): Promise<void> {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: this.from,
        to,
        subject: 'Your Roodle sign-in link',
        html:
          `<p>Tap to sign in to Roodle:</p>` +
          `<p><a href="${url}">${url}</a></p>` +
          `<p>This link is single-use and expires in 15 minutes.</p>`,
      }),
    });
    if (!res.ok) {
      throw new Error(`Resend send failed: ${res.status} ${await res.text()}`);
    }
  }
}

/**
 * Pick the transport from env: Resend when a key + from-address are configured,
 * otherwise log the link server-side (dev, or prod before email is wired).
 */
export function defaultTransport(): EmailTransport {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (key && from) return new ResendTransport(key, from);
  return new ConsoleTransport();
}
