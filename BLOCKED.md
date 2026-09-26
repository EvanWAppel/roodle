# BLOCKED — what I need from Evan

- [ ] 🔴 **Redeploy production from `main` on Railway** — the live app
  (https://roodle-web-production.up.railway.app) is running a stale build from
  before PR #7: `/friends`, `/api/auth/session`, `/packs`, and `/api/notify` all
  404, so real friend-based play (invite Christine → draw → nudge → guess) is not
  live. Merging PRs never triggered a deploy. **To unblock:** in the Railway
  dashboard → `roodle-web` service, either (a) turn on auto-deploy for the `main`
  branch under Settings → Source, or (b) trigger a manual deploy of the latest
  `main` commit. New migrations (`0003_packs_words`, `0004_notify_enabled`) and
  built-in-pack seeding run automatically on first boot. **Also set** an env var
  `APP_URL=https://roodle-web-production.up.railway.app` (Variables tab) so magic
  links and turn-nudge deep links use the canonical host. After it deploys,
  `GET /api/notify` should return 401 (not 404) — ping me and I'll verify.

<!-- Add a `- [ ]` line the moment something needs Evan. Format:
- [ ] 🔴 <blocking thing> — exact steps to unblock: the action, where (file / env-var / URL / dashboard), any link, why it's safe. (T-xx)
- [ ] 🟡 <nice-to-have> — same.
Only open `- [ ]` items are mirrored into Evan's todo dashboard. -->
