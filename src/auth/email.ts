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

/** Default transport until a real provider is wired (guardrail-gated): log it. */
export class ConsoleTransport implements EmailTransport {
  async sendMagicLink(msg: MagicLinkEmail): Promise<void> {
    console.log(`[roodle] magic link for ${msg.to}: ${msg.url}`);
  }
}

export function defaultTransport(): EmailTransport {
  // A real provider (e.g. Resend) plugs in here once its key clears the
  // personal-key checklist. Until then, log the link server-side.
  return new ConsoleTransport();
}
