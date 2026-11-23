# BLOCKED — what I need from Evan

These are the only Roodle items left, all needing a browser or your hands (the
automated a11y audit, tests, lint, typecheck, and production build are all done):

- [ ] 🟡 Manual responsive/a11y visual sweep at **320 / 390 / 1440px** — open the app
  (`npm run dev`, http://localhost:3000) and eyeball every screen (home, /try, /draw,
  /play, /friends, /packs, /scores, /gallery, /signin) at those widths: check for
  overflow, tap-target comfort, visible keyboard focus, canvas/replay fidelity, and
  the wrong/success/empty feedback states. Code-level checks already pass; this is the
  human confirmation. (DESIGN-12 / POLISH-01, -02)
- [ ] 🔴 Production deploy + custom domain — deploy `main` to the live host (Railway)
  and confirm the app loads on a stable URL; set the custom domain (PRD OQ2). Then
  smoke-test that magic-link sign-in and invite emails work against the deployed host.
  (DESIGN-13 / POLISH-04)
  *2026-10-22 check: https://roodle.evanappel.me/ already returns 200 from Railway. If that
  service runs current `main` (121ec87), only the email smoke test remains — tick this and
  POLISH-04 in `TASKS.md`.*
- [ ] 🟡 Real game with Christine end-to-end on the deployed app — invite, draw, guess,
  score, browse the gallery. Capture any feedback so I can turn it into next-iteration
  tasks in `DECISIONS.md` / `TASKS.md`. (DESIGN-13 / POLISH-06)

- [ ] 🟡 Decide GUESS-05 hint scoring — should a guess that used the "reveal one letter"
  hint still earn the flat 1 point (D5), earn 0, or not be offered at all? Reply in a
  session or write the answer under a new `DECISIONS.md` entry; a weekend session can then
  build it test-first. Unblocks GUESS-05.
- [ ] 🟡 ROCRLL standing rules live only on `feat/design-12-13-polish` (WIP snapshot
  `cdeeaf1`, adds the `factotum:recl-standing-rules` block to `CLAUDE.md`/`AGENTS.md`), not on
  `main`. Say "land the ROCRLL rules on main" and a session will open a docs-only PR, or
  delete that branch if the snapshot is obsolete.
- [ ] 🟡 `project.toml` `[auth] target` is `unknown` — tell a session whether roodle stays on
  its own magic-link auth or moves behind Cloudflare Access / another scheme, then flip
  `verified = true` after checking the draft.

- [ ] 🔴 [sec] **Mint and wire `ROODLE_READ_TOKEN` for the ложь turn feed (X8 / EA-221).** After the
  `x8-news-turns` PR merges: run `openssl rand -base64 32`, save it in 1Password `news` →
  `roodle_read_token`. In Railway (`roodle-web` → Variables) set `ROODLE_READ_TOKEN` to it and
  `NEWS_PLAYER_EMAIL` to your roodle sign-in email. In the news repo, add the same token to its
  Actions secrets. Then deploy roodle. Until then the route returns 401 to everyone (fails closed),
  so nothing is exposed meanwhile.

<!-- Add a `- [ ]` line the moment something needs Evan. Format:
`- [ ] 🔴 <blocking thing> — exact steps to unblock: the action, where (file / env-var / URL / dashboard), any link, why it's safe. (T-xx)`
`- [ ] 🟡 <nice-to-have> — same.`
Only open `- [ ]` items are mirrored into Evan's todo dashboard. -->
