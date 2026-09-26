# BLOCKED — what I need from Evan

- [ ] 🔴 **Set `APP_URL` on Railway so magic links aren't localhost** — the latest
  `main` is deployed (verified: `/api/notify` → 401, `/friends` → 200), but sign-in
  magic links (and turn-nudge deep links) point to `localhost` because `APP_URL` is
  unset — the code falls back to the request origin, which behind Railway's proxy is
  localhost. **To unblock:** Railway → `roodle-web` → Variables → add
  `APP_URL=https://roodle-web-production.up.railway.app` (no trailing slash), then
  let it restart / Redeploy. Already-emailed links are dead; request a fresh sign-in
  link after. Consider also enabling auto-deploy on `main` (Settings → Source) so
  future merges deploy without a manual step. Ping me and I'll re-verify a fresh link.

<!-- Add a `- [ ]` line the moment something needs Evan. Format:
- [ ] 🔴 <blocking thing> — exact steps to unblock: the action, where (file / env-var / URL / dashboard), any link, why it's safe. (T-xx)
- [ ] 🟡 <nice-to-have> — same.
Only open `- [ ]` items are mirrored into Evan's todo dashboard. -->
