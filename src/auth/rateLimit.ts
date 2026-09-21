/**
 * In-memory sliding-window rate limiter. Fine for a single-instance service
 * (roodle on Railway). Protects the sign-in endpoint from spamming the shared
 * email quota.
 */
export class RateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  /** Record a hit for `key`; return true if it is within the limit. */
  check(key: string, now: number = Date.now()): boolean {
    const recent = (this.hits.get(key) ?? []).filter(
      (t) => now - t < this.windowMs,
    );
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }
}
