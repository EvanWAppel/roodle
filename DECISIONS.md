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
