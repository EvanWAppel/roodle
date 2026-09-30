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
- [ ] 🟡 Real game with Christine end-to-end on the deployed app — invite, draw, guess,
  score, browse the gallery. Capture any feedback so I can turn it into next-iteration
  tasks in `DECISIONS.md` / `TASKS.md`. (DESIGN-13 / POLISH-06)

<!-- Add a `- [ ]` line the moment something needs Evan. Format:
- [ ] 🔴 <blocking thing> — exact steps to unblock: the action, where (file / env-var / URL / dashboard), any link, why it's safe. (T-xx)
- [ ] 🟡 <nice-to-have> — same.
Only open `- [ ]` items are mirrored into Evan's todo dashboard. -->
