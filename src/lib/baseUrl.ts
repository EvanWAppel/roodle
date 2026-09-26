/**
 * Resolve the app's canonical public base URL (scheme + host, no trailing slash)
 * for building absolute links (magic links, invites, turn-nudge deep links) and
 * post-auth redirects.
 *
 * Precedence:
 *  1. `APP_URL` — the explicit canonical origin. Set this in production; it always
 *     wins, so a spoofed forwarded header can never influence links/redirects.
 *  2. `x-forwarded-host` (+ `x-forwarded-proto`) — set by the reverse proxy
 *     (Railway, Vercel, …). This is the real external host; `req.url` behind a
 *     proxy is the *internal* address (e.g. `localhost:8080`), which is why links
 *     and redirects broke before this existed.
 *  3. `new URL(req.url).origin` — direct-connection fallback (local dev).
 *
 * SECURITY: the forwarded-host fallback trusts a proxy header, so it must only be
 * relied on behind a proxy that overwrites client-supplied `x-forwarded-*`. In
 * production set `APP_URL` so this fallback is never reached. This is still a
 * strict improvement over the previous `req.url` origin, which yielded an
 * unreachable `localhost` host for every emailed link and redirect.
 */
export function resolveBaseUrl(req: Request): string {
  const appUrl = process.env.APP_URL?.trim();
  if (appUrl) return appUrl.replace(/\/+$/, '');

  const forwardedHost = req.headers
    .get('x-forwarded-host')
    ?.split(',')[0]
    ?.trim();
  if (forwardedHost) {
    const forwardedProto =
      req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || 'https';
    return `${forwardedProto}://${forwardedHost}`;
  }

  return new URL(req.url).origin;
}
