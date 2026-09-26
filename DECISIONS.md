# Roodle — Decisions log

Append-only record of decisions with a real trade-off (chose X, rejected Y, why).
Per ROCRLL: the agent drafts; **Evan confirms**. Newest at the bottom.

---

### D1 — Stack: Next.js + Vercel + Postgres (Neon)
- **Date:** 2026-09-20
- **Status:** ✅ Confirmed by Evan (SCAF-01 gate).
- **Chose:** Next.js (App Router, TypeScript) on Vercel; Postgres via Vercel
  Marketplace (Neon) in production.
- **Rejected:** other frameworks/hosts.
- **Why:** matches Evan's standing preference (TS/Next.js frontends on Vercel
  under `evanappel.me`) and PRD §8. Async, small-group app fits serverless well.

### D2 — Delivery order: foundation + vertical slice before any fan-out
- **Date:** 2026-09-20
- **Status:** ✅ Confirmed (agreed when kicking off).
- **Chose:** Build `SCAF` then `SLICE` strictly sequentially; fan out the
  parallel groups (AUTH/GROUP/DRAW/WORD/GUESS/SCORE/NOTIF) into worktrees only
  after `SLICE-13`.
- **Rejected:** spawning many agents immediately.
- **Why:** the slice defines the shared DB schema + API contracts; parallel
  agents on an empty repo would each invent a schema and collide on first merge
  (ROCRLL orchestration rule).

### D3 — Local-first data layer: Drizzle ORM + PGlite (dev/test), Neon (prod)
- **Date:** 2026-09-20
- **Status:** 🟡 Proposed by orchestrator — pending Evan confirm (low stakes).
- **Chose:** Drizzle ORM with **PGlite** (in-process WASM Postgres) for local
  development and tests; the same Drizzle schema targets Neon Postgres in prod.
- **Rejected:** (a) SQLite locally — diverges from Postgres (JSON, types) and
  risks "works locally, breaks in prod"; (b) requiring a local Docker Postgres —
  friction for a local-first, zero-external-service start.
- **Why:** keeps the "local-first" choice (D2/infra) while running **real
  Postgres semantics** locally, so stroke-JSON columns and queries behave the
  same everywhere. One schema, no dialect drift.

### D4 — Test stack: Vitest + Testing Library
- **Date:** 2026-09-20
- **Status:** 🟡 Proposed by orchestrator — pending Evan confirm (low stakes).
- **Chose:** Vitest as the test runner with @testing-library/react + jsdom.
- **Rejected:** Jest (heavier config with ESM/Next 16), Playwright-only.
- **Why:** fast, ESM-native, minimal config; TDD-friendly watch mode. Matches the
  test-first mandate in TASKS.md.

### D5 — Scoring: flat 1 point per correct guess (for now)
- **Date:** 2026-09-20
- **Status:** 🟡 Proposed — pending Evan confirm (PRD OQ3).
- **Chose:** a correct guess awards a flat **1 point**; stats derive from turn
  outcomes (points, correct guesses, streaks) rather than a stored score.
- **Rejected:** difficulty- or speed-scaled points.
- **Why:** words carry no difficulty yet (that arrives with the WORD packs
  group), and derived stats keep scoring in one place. Easy to swap the formula
  later without a migration. Revisit once packs add difficulty.

### D6 — Single dev DB instance pinned on globalThis
- **Date:** 2026-09-20
- **Status:** ✅ Adopted (forced by a runtime 500 on `/scores`).
- **Chose:** cache the PGlite/Drizzle promise on `globalThis.__roodleDb`.
- **Rejected:** a plain module-level singleton.
- **Why:** in Next dev, Server Components (react-server condition) and Route
  Handlers load `client.ts` in **separate module graphs**, so a module-level
  singleton is duplicated — each copy opened its own file-backed PGlite on the
  same file and collided during `migrate` (`CREATE SCHEMA "drizzle"` failed →
  500). `globalThis` is shared across both graphs in one process, guaranteeing
  one instance. Caught only by a runtime curl of `/scores`; tests use in-memory
  DBs and never hit it — a reminder to smoke real routes, not just units.

### D7 — Deploy target: Railway (exception to the Next.js→Vercel convention)
- **Date:** 2026-09-20
- **Status:** ✅ Confirmed by Evan (explicitly asked to deploy to Railway).
- **Chose:** deploy on **Railway** — app service `roodle-web` + a Railway
  Postgres addon; `DATABASE_URL` injected via a service reference
  (`${{Postgres.DATABASE_URL}}`); migrations run on first boot. Public URL:
  https://roodle-web-production.up.railway.app · repo:
  https://github.com/EvanWAppel/roodle (public, branch-protected).
- **Rejected:** Vercel + Neon (Evan's standing "Next.js frontends → Vercel"
  convention).
- **Why:** roodle is a **full-stack** Next.js app (API + Postgres), not a pure
  frontend, so co-locating the long-running Node server and its DB on Railway
  (as with the Python apps) is a clean fit. `next start` is long-lived, which
  suits postgres-js pooling. No personal API keys involved, so the personal-key
  guardrail did not apply; only Railway's managed `DATABASE_URL` is a secret.

### D8 — Auth: minimal custom magic-link (not Auth.js)
- **Date:** 2026-09-20
- **Status:** 🟡 Proposed by orchestrator — pending Evan confirm.
- **Chose:** a small, self-built magic-link flow: single-use, expiring tokens
  stored hashed in an `auth_tokens` table; sign-in sets an HMAC-signed httpOnly
  session cookie (`AUTH_SECRET`). Email delivery goes through a **pluggable
  transport** (dev: logs the link; prod: a provider, TBD).
- **Rejected:** Auth.js / NextAuth — heavier, its own adapter + schema, more
  friction on Next 16 for a 2–4 person private game with no sensitive data.
- **Why:** keeps with the project's simple/TDD/local-first ethos; the whole flow
  is unit-testable without a live email provider, and the provider stays behind
  an interface so wiring it (a personal-key/guardrail step) is deferred and
  isolated. Auth is built but **not enforced** until email works, so the live
  app keeps running on the dev player-switch meanwhile.

### D9 — Email provider: Resend on Evan's shared account (informed acceptance)
- **Date:** 2026-09-21
- **Status:** ✅ Confirmed by Evan.
- **Chose:** Resend, sending from the verified **krangly.com** domain, via a
  dedicated revocable `roodle` API key on Evan's existing (shared) Resend
  account — the same one Wordly uses.
- **Rejected:** a fully isolated, separate Resend account/workspace.
- **Why:** Evan explicitly accepted the tradeoff — free tier has no spend (worst
  case is exhausting the shared ~3k/mo quota, not a charge), Wordly already runs
  the same pattern, and roodle uses low volume. Mitigations: a dedicated key
  (revocable without touching Wordly) + rate-limiting on `/api/auth/request`
  (4/15min per email, 30/15min per IP). Verified in prod: a real magic link
  delivered (HTTP 200 from Resend). Evan will re-evaluate if it hits the cap.

### D10 — AUTH-06 bundled with GROUP: real sessions + friend-created games together
- **Date:** 2026-09-22
- **Status:** ✅ Confirmed by Evan (2026-09-22). Evan chose to bundle GROUP into
  the AUTH-06 sequential step during the fan-out kickoff.
- **Chose:** implement AUTH-06 (real magic-link sessions everywhere; delete the
  dev `PlayerSwitch`, the `/api/session?as=` stub, and the `.local` seed) **in the
  same sequential step** as GROUP-01..05 (invite + friendship schema/migration,
  `POST /api/invites` invite-by-email, accept-by-token creating the friendship +
  game, friend-only enforcement on `POST /api/turns`, invite/friends UI). So the
  moment the dev switch is gone, the app has **both** real identity and a real
  opponent/game.
- **Rejected:** (a) keep the seeded pair as a temporary bridge until GROUP lands;
  (b) full rip-out with a dead-end "invite a friend" empty state until GROUP lands.
- **Why:** removing the dev switch leaves `/play` & `/draw` with no opponent/game
  unless friend-created games exist; building GROUP now keeps the live app
  continuously playable rather than shipping an interim bridge or an empty state.
- **Sub-decisions (built as-is, low stakes):** invite tokens hashed with the
  existing **SHA-256** `hashToken` scheme (matching magic-link tokens; only the
  hash is stored); **7-day** invite TTL (vs 15-min magic links); `sendInvite`
  added to the `EmailTransport` interface (distinct subject/copy vs reusing
  `sendMagicLink`); a minimal `/friends` invite page; `/scores` renders per-friend
  scoreboards + the user's lifetime stats; a non-production `seedDevFriends`
  helper retained for local play/tests (throws in prod, not used by any route).

### D11 — Security review adjudication: fix all found authZ holes before merge
- **Date:** 2026-09-22
- **Status:** ✅ Confirmed by Evan (2026-09-22) — Evan's adjudication call ("fix all 4").
- **Chose:** an independent adversarial review of the AUTH-06+GROUP diff found
  four real authorization holes; Evan chose to fix **all four** on the branch
  before merge — including two that were **pre-existing** (not introduced by this
  branch) but now the weak link in the friend-only model:
  1. `acceptInvite` didn't bind to the invitee's email → a leaked/forwarded invite
     link let any signed-in user become the inviter's "friend" (**CRITICAL**).
     Fixed: reject unless the accepting user's normalized email matches the invite.
  2. Post-login redirect (`safeReturnTo`) allowed an open redirect via backslash /
     `//` / `/..//evil.com` path-collapse (**HIGH**). Fixed with a two-guard check
     that re-validates the final redirect origin against the request origin.
  3. `GET /api/turns` was unauthenticated → anyone could read another user's
     pending turns *including the secret word* (**MEDIUM**, pre-existing). Fixed:
     require a session and `caller === guesser`.
  4. `POST /api/turns/:id/guess` was unauthenticated → anyone could guess / force
     give-up on any turn (**MEDIUM**, pre-existing). Fixed: require a session and
     `caller === turn.guesser`.
- **Rejected:** fixing only the two new-code blockers and deferring the two
  pre-existing MEDIUM endpoints to follow-up tasks.
- **Why:** the pre-existing endpoints undermine the very friend-only guarantee
  this step introduces; closing them now keeps main sound. Two further review
  rounds verified each fix (incl. a residual open-redirect vector) is closed, with
  a regression test per finding.

### D12 — Post-AUTH fan-out: two waves, NOTIF deferred to wave 2
- **Date:** 2026-09-25
- **Status:** 🟡 Proposed by orchestrator — pending Evan confirm.
- **Chose:** fan out the remaining parallel groups in **two waves** of
  worktree-isolated agents, merged one at a time with central Check + adversarial
  Review per merge (ROCRLL):
  - **Wave 1 (parallel):** **WORD** (packs schema + selection + API + UI),
    **GUESS** (replay controls, decoy/tile polish, give-up/reveal), **DRAW-06**
    (stroke-schema validation + size budget on `POST /api/turns`).
  - **Wave 2 (after wave 1 merges):** **NOTIF** (email nudges + `notify_enabled`).
- **Rejected:** running all four groups (incl. NOTIF) in one parallel wave.
- **Why:** wave-1 groups are **file-disjoint** once NOTIF is held back — WORD owns
  `schema.ts`/migrations/`words.ts`/draw page, DRAW-06 owns `strokes.ts`/turns
  route, GUESS owns the guess lib+components/play page. **NOTIF is the coupling
  magnet**: it must edit `schema.ts` (a `notify_enabled` column + migration), the
  turns route (nudge on create) and the guess route (nudge on resolve) — every one
  a file another wave-1 agent already owns. Sequencing it second lets it build on
  the settled schema/routes with near-zero merge conflict, instead of racing three
  agents on the same three files. Worktree isolation per D2's fan-out rule.
- **Constraint carried into wave 1:** WORD adds word **difficulty as metadata
  only**; it must NOT change the flat-1-point scoring of D5 — whether to scale
  points by difficulty stays Evan's call (revisit D5). Pack *contents* the WORD
  agent seeds are drafts for Evan to confirm at merge.
