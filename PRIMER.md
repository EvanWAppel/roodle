# Roodle — PRIMER

## Next session — 2026-10-24 weekend

**Goal.** Roodle is a small, private, ad-free async draw-and-guess game for Evan, Christine and
friends (Draw Something without the ads or coin shop). It is also a portfolio piece on evanappel.me.

**Current state (main @ bfb0d1a, 2026-10-23).**
- Feature-complete against the PRD: magic-link auth, friend invites, drawing studio, replay plus
  letter-tile guessing, word packs, scores, gallery, email nudges, signed-out `/try` sample round,
  and the creative-studio redesign (DESIGN-01…11). CI (lint, typegen, typecheck, test) is on main.
- Stack: Next.js 16.3 (App Router), React 19, Drizzle ORM, PGlite for dev and tests, Railway
  Postgres in prod, Resend email, Vitest plus Testing Library. Deployed on Railway (`roodle-web`).
  https://roodle.evanappel.me and https://roodle-web-production.up.railway.app both returned 200
  (2026-10-22).
- The four weekend tasks below (W-01…W-04) all merged in PR #23 (2026-10-23).
- No open PRs. Every remote feature branch is merged. Evan's local checkout is on
  `feat/design-12-13-polish` with one extra WIP commit (`cdeeaf1`, the ROCRLL rules block in
  CLAUDE.md/AGENTS.md). Don't touch it (see BLOCKED.md).
- **Test baseline (2026-10-23, from PR #23's review pass):** plain `npm run test:run` passes
  275 tests in 49 files; lint and typecheck are clean. W-01 fixed the load-related PGlite hook
  timeouts (one migrated template per run, `maxWorkers: 4`, DECISIONS D17), and W-02 made
  `npm run typecheck` run `next typegen` itself.

**Test commands.**
```
npm ci
npm run typecheck                    # runs next typegen, then tsc --noEmit
npm run lint
npm run test:run                     # full suite
npx vitest run src/path/to/file.test.ts   # single file
```

### Autonomous tasks, in order

All four are done (merged in PR #23). No autonomous tasks remain; everything left needs Evan
(BLOCKED.md: the visual sweep, POLISH-04/06, GUESS-05 scoring, the ROCRLL snapshot, the
`project.toml` auth target). Kept below for the record.

1. ~~**W-01 Stabilise the test harness under load.**~~ *(done, PR #23)* `src/db/testDb.ts` boots a fresh PGlite and
   runs every migration per test (23 test files use it). Either migrate one template DB per
   worker and clone it per test (check that PGlite 0.5 has `clone()`/`dumpDataDir` in
   `node_modules/@electric-sql/pglite`), or cap workers in `vitest.config.mts`, or do both. Record the
   trade-off in DECISIONS.md.
   *Done when:* plain `npm run test:run` passes 266/266 twice in a row with no flags, wall time is
   noted before and after, and lint and typecheck are clean.
2. ~~**W-02 Make `typecheck` self-sufficient.**~~ *(done, PR #23)* Change the script to `next typegen && tsc --noEmit`
   and drop the separate typegen step from `.github/workflows/ci.yml`.
   *Done when:* `rm -rf .next && npm run typecheck` passes, and CI YAML still covers lint, typecheck and test.
3. ~~**W-03 Replace the boilerplate README.**~~ *(done, PR #23)* It is still the create-next-app README. Cover what Roodle is,
   local dev (PGlite needs no DB; `PGLITE_PATH` optional), the scripts, the env var **names** the code reads
   (`DATABASE_URL`, `AUTH_SECRET`, `APP_URL`, `RESEND_API_KEY`, `EMAIL_FROM`, `PGLITE_PATH`),
   migrations in `drizzle/`, and deploy notes pointing to DECISIONS D7/D9. Get the env var names from the
   code. **Never open `.env*`, including `.env.example`.**
   *Done when:* README has no create-next-app text and every command in it runs.
4. ~~**W-04 Reconcile planning docs with reality.**~~ *(done, PR #23; OQ5/OQ6 stay open)* Mark the PRD §13 open questions as resolved where they are
   (OQ1→D1/D7 Railway, OQ3→D5, OQ4→§14; OQ2 domain → roodle.evanappel.me appears live), and
   annotate SCAF-08 and SCAF-06 in TASKS.md, which still say Vercel/Neon, with the Railway reality (D7). Don't
   tick POLISH-04/06 or DESIGN-12/13. Those are Evan's.
   *Done when:* docs-only diff, and no checkbox changes beyond annotations.

Anything beyond these four needs Evan. Stop and leave it.

### House rules (from CLAUDE.md / AGENTS.md / TASKS.md)
- **TDD is mandatory.** Write the failing test first, then minimal code, then refactor. A task isn't done until its test passes
  *and* lint and typecheck pass.
- **Next.js 16 is not the Next you know.** Read `node_modules/next/dist/docs/` before touching
  app code, and heed deprecation notices. `next dev` re-adds the agent-rules block to AGENTS.md. Commit it rather than
  fighting it.
- **ROCRLL.** Record real trade-offs in `DECISIONS.md` (draft them; Evan confirms). Fan out only for 3 or more truly
  independent tasks, each in its own worktree. Run an adversarial review before anything heads to main.
- Anything only Evan can resolve goes in `BLOCKED.md` (canonical format, exact unblock steps).
- If anything is unclear, stop and ask. Don't guess.

### Do NOT
- Deploy, run `railway`/`vercel` commands, touch DNS, or send any email (Resend). No merges.
- Read `.env` or `.env.*` files (that includes `.env.example`).
- Use browser automation. Verify with tests, curl and logs only. The 320/390/1440px visual sweep
  (DESIGN-12, POLISH-01/02) is Evan's.
- Do POLISH-04 (prod deploy and domain), POLISH-06 (real game with Christine), or the SCAF-08 deploy half.
- Build **GUESS-05** (hint): its scoring is an open decision in BLOCKED.md.
- Add reload or offline persistence for drafts (DESIGN-07 explicitly deferred it, and storage lifetime is a design call).
- Modify Evan's checkout at `~/Documents/portfolio/games/roodle` or its `feat/design-12-13-polish` branch.
- Add paid keys or new external services.
- Encrypted paths: none. The repo has no `.gitattributes` / git-crypt.
