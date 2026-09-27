# Roodle — TASKS

Implementation task list for the [PRD](./PRD.md). Test-driven throughout, with a
**minimal end-to-end vertical slice first** so we can confirm the core loop works
before building anything out.

---

## How to read this file

- **`[ ]` / `[x]`** — completion checkbox per task.
- **Unique IDs** — `PREFIX-NN` (e.g. `SLICE-03`). Never reuse an ID.
- **TDD is mandatory.** Every implementation task is **test-first**: write the
  failing test named in the task, watch it fail, then write the minimum code to
  make it pass, then refactor. A task is not `[x]` until its test is green *and*
  lint/typecheck pass.
- **Parallelism.** Groups marked **⇄ parallel-safe** can run concurrently in
  separate worktrees once their stated dependencies are done. Groups marked
  **→ sequential** must land in order. Fan out to agents only per the ROCRLL rule
  (≥3 genuinely independent tasks, own worktree, merge one at a time, Check +
  Review at each join).
- **Stack assumption:** TS + Next.js (App Router) on Vercel, Postgres, per PRD §8.
  This is pending Evan's confirmation (PRD OQ1) — `SCAF-01` locks it before code.

### Dependency map

```
SCAF (foundation)  →  SLICE (thin end-to-end loop)  →  ┌ AUTH  ⇄
                                                       ├ GROUP ⇄
                                                       ├ DRAW  ⇄
                                                       ├ WORD  ⇄   (parallel-safe)
                                                       ├ GUESS ⇄
                                                       ├ SCORE ⇄
                                                       └ NOTIF ⇄
                                                              ↓
                                                          POLISH (integration + ship)
```

---

## Group SCAF — Scaffold & tooling  → sequential · blocks everything

Goal: a running, tested, deployable skeleton. Do this first, linearly.

- [x] **SCAF-01** Confirm stack with Evan (PRD OQ1) and record the decision in
  `DECISIONS.md` (chose X, rejected Y, why). Blocks all coding tasks below.
- [x] **SCAF-02** Initialize standalone git repo for `roodle` (ROCRLL precondition
  for worktrees) with `.gitignore`.
- [x] **SCAF-03** Scaffold Next.js (App Router, TypeScript) app; app boots locally.
- [x] **SCAF-04** Add tooling: test runner (Vitest/Jest), ESLint, Prettier,
  TypeScript strict mode; add `test`/`lint`/`typecheck` scripts.
- [x] **SCAF-05** Add a trivial `sum()`-style unit test and a smoke test that the
  home route renders — prove the TDD harness runs red→green.
- [x] **SCAF-06** Provision Postgres (Vercel Marketplace) + choose ORM/query layer;
  add DB connection module with a health-check test.
- [x] **SCAF-07** Add DB migration tooling; commit an empty initial migration.
- [ ] **SCAF-08** Set up CI (lint + typecheck + test on push) and a first Vercel
  deploy of the skeleton to a stable preview URL.
- [x] **SCAF-09** Create `BLOCKED.md` (standard furniture; heading + "nothing
  blocked right now", zero checkboxes until something blocks).

---

## Group SLICE — Minimal vertical slice  → sequential · depends on SCAF

**Goal: the whole loop working end-to-end ASAP**, deliberately minimal. Cut every
corner that isn't the loop: **two hardcoded players, one built-in word list, no
real auth, no email, no custom packs.** Prove: draw → submit → replay → tile-guess
→ point. This slice establishes the shared data model + API contracts the parallel
groups build on, so it must land before fan-out.

- [x] **SLICE-01** Define minimal DB schema + migration: `user` (seeded with two
  players), `game`, `turn` (with `strokes` JSON, `word`, `status`,
  `points_awarded`). Test: migration applies; models round-trip.
- [x] **SLICE-02** Hardcode a tiny built-in word list (constant module). Test:
  `pickRandomWord()` returns a word from the list.
- [x] **SLICE-03** Stub identity: a dev-only "play as Player A / Player B" switch
  (no real auth yet). Test: current-player resolver returns the selected player.
- [x] **SLICE-04** `POST /api/turns` — create a turn (drawer, guesser, word,
  strokes). Test (API): valid payload persists a turn with status
  `awaiting_guess`; invalid payload 400s.
- [x] **SLICE-05** `GET /api/turns?for=<player>` — list pending turns for the
  guesser. Test: returns only that player's `awaiting_guess` turns.
- [x] **SLICE-06** Minimal canvas that records **ordered strokes as vector JSON**
  (points only, one color/width). Test: a simulated drag produces an ordered
  point array; `clear` empties it.
- [x] **SLICE-07** Draw screen: pick the offered word, draw, submit → calls
  `POST /api/turns`. Test (component): submit posts the recorded strokes + word.
- [x] **SLICE-08** Stroke **replay** renderer: given strokes JSON, animate them in
  draw order. Test: replay visits points in recorded order; final frame matches.
- [x] **SLICE-09** Minimal **letter-tile** guess UI: blanks + scrambled correct
  letters, tap to fill/clear. Test: filling blanks to spell the word yields a
  correct match (case/space-insensitive); wrong fill does not.
- [x] **SLICE-10** `POST /api/turns/:id/guess` — submit a guess; correct →
  status `guessed`, award 1 point; give-up → status `gave_up`, reveal word, 0
  points. Test (API): both branches.
- [x] **SLICE-11** Guess screen wiring: pending list → replay → tiles → submit →
  outcome shown. Test (component): correct guess renders success + point.
- [x] **SLICE-12** **End-to-end slice test**: Player A draws & submits → Player B
  sees pending → guesses correctly → point recorded. This green = the loop works.
- [x] **SLICE-13** Deploy the slice; Evan + Christine play one manual round to
  confirm it feels right. (Check-in gate before fan-out.)

---

## Group AUTH — Magic-link email auth  ⇄ parallel-safe · depends on SLICE

Replaces the SLICE-03 dev stub with real identity.

- [x] **AUTH-01** Choose auth approach (Auth.js email provider vs Marketplace
  integration; PRD TQ1) → record in `DECISIONS.md`.
- [x] **AUTH-02** Magic-link request: `POST /api/auth/request` issues a signed,
  expiring token for an email. Test: token verifies before expiry, rejects after.
- [x] **AUTH-03** Magic-link callback signs the user in and creates the `user`
  row if new. Test: valid link → session; reused/expired link → rejected.
- [x] **AUTH-04** Session middleware / current-user resolver. Test: protected
  route 401s without session, 200s with.
- [x] **AUTH-05** Sign-in / sign-out UI + "check your email" state. Test
  (component): submitting an email calls the request endpoint.
- [x] **AUTH-06** Swap SLICE-03 stub for real sessions everywhere; delete the dev
  switch. Test: SLICE E2E still green under real auth. *(Done with GROUP as one
  sequential step — see D10. SLICE-12 E2E green under real auth via
  `createFriendPair`.)*

## Group GROUP — Invites & friends  ⇄ parallel-safe · depends on SLICE, AUTH

- [x] **GROUP-01** Schema + migration for `friendship`/`invite` (inviter,
  invitee_email, token, status). Test: models round-trip. *(migration
  `0002_invites_friendships.sql`; unique pair constraint.)*
- [x] **GROUP-02** `POST /api/invites` — invite by email, issue invite link.
  Test: creates a pending invite; duplicate pending invite is rejected (409).
- [x] **GROUP-03** Accept invite → creates the friendship. Test: accepting links
  the two users; expired/invalid token rejected; **bound to the invitee's email**
  (D11) so a leaked link can't hijack the friendship; idempotent.
- [x] **GROUP-04** Enforce "can only start a game with a friend." Test: creating a
  turn to a non-friend 403s; drawer taken from the session, game must match pair.
- [x] **GROUP-05** Invite + friends-list UI (`/friends`). Test (component):
  submitting an email posts to `/api/invites`.

## Group DRAW — Drawing tools & fidelity  ⇄ parallel-safe · depends on SLICE

Deepens the SLICE-06 minimal canvas.

- [x] **DRAW-01** Brush sizes. Test: selected width is recorded per stroke.
- [x] **DRAW-02** Color palette. Test: selected color is recorded per stroke.
- [x] **DRAW-03** Eraser tool. Test: eraser strokes are captured + replay-able.
- [x] **DRAW-04** Undo + clear. Test: undo removes the last stroke; clear empties.
- [x] **DRAW-05** Touch + pointer support (phone primary). Test: pointer events
  produce the same stroke model as mouse.
- [x] **DRAW-06** Define + validate the stroke-data schema and a size budget
  (PRD TQ4). Test: oversized/malformed stroke payloads are rejected.
- [ ] **DRAW-07** (Optional) render a static thumbnail per submitted drawing for
  galleries. Test: thumbnail generated from strokes.

## Group WORD — Word packs (built-in + custom)  ⇄ parallel-safe · depends on SLICE

- [x] **WORD-01** Schema + migration for `pack` and `word` (difficulty). Test:
  round-trip.
- [x] **WORD-02** Seed curated built-in packs (categories + difficulty). Test:
  seed loads expected counts.
- [x] **WORD-03** Word selection honors enabled packs + difficulty. Test: only
  words from enabled packs at the chosen difficulty are offered.
- [x] **WORD-04** `POST /api/packs` — create a custom pack (name + word list).
  Test: persists; empty/invalid pack rejected.
- [x] **WORD-05** Enable/disable packs per game. Test: disabled pack's words never
  offered.
- [x] **WORD-06** Pack management UI (create custom, toggle enabled). Test
  (component): creating a pack posts the words.

## Group GUESS — Replay & letter-tile guessing  ⇄ parallel-safe · depends on SLICE

Deepens SLICE-08/09.

- [x] **GUESS-01** Replay controls: replay-again + jump-to-final. Test: controls
  reset/complete the animation.
- [x] **GUESS-02** Tile tray with **decoy letters** mixed in. Test: tray contains
  all correct letters plus N decoys; still solvable.
- [x] **GUESS-03** Tile UX polish: tap-to-place next blank, tap-filled-to-clear,
  visual "wrong" feedback. Test: interactions update blanks correctly.
- [x] **GUESS-04** Give-up / reveal flow with word reveal. Test: reveal shows the
  word and records `gave_up`.
- [ ] **GUESS-05** (Optional) hint: reveal one letter. Test: a hinted letter is
  pre-placed and locked.

## Group SCORE — Scoring & stats  ⇄ parallel-safe · depends on SLICE

- [x] **SCORE-01** Points formula (flat vs difficulty-scaled; PRD OQ3) → decide +
  record in `DECISIONS.md`. Test: formula returns expected points per case.
- [x] **SCORE-02** Per-game scoreboard. Test: correct guesses accumulate the
  running score correctly.
- [x] **SCORE-03** Per-player lifetime stats (games, correct guesses, points,
  current/longest streak). Test: streak increments on consecutive correct guesses
  and resets on give-up.
- [x] **SCORE-04** Per-game history + past-drawings gallery. Test: resolved turns
  appear with word + outcome.
- [x] **SCORE-05** Scoreboard + stats UI. Test (component): renders values from
  the stats API.

## Group NOTIF — Email turn nudges  ⇄ parallel-safe · depends on SLICE

- [x] **NOTIF-01** Choose email provider + verified sender domain (PRD TQ2) →
  record in `DECISIONS.md`.
- [x] **NOTIF-02** Email-send module (magic links + nudges), mockable in tests.
  Test: send is called with correct recipient/subject/body; failures surface
  (no silent swallow).
- [x] **NOTIF-03** Trigger a **single** nudge when a turn becomes someone's turn
  (draw submitted / guess resolved). Test: exactly one email per pending turn.
- [x] **NOTIF-04** Deep link in the email opens the pending turn. Test: link
  resolves to the correct turn.
- [x] **NOTIF-05** Per-user notify toggle + unsubscribe; respect `notify_enabled`.
  Test: disabled users get no email.

---

## Group POLISH — Integration, a11y, ship  → sequential · depends on all above

- [ ] **POLISH-01** Mobile-first responsive pass on every screen. Test/visual
  check on phone viewport.
- [ ] **POLISH-02** Accessibility: contrast, tap-target sizes, keyboard guessing
  on desktop. Test: a11y checks pass on key screens.
- [ ] **POLISH-03** Confirm **zero ads / zero purchase prompts** anywhere (product
  constraint, PRD NFR-1). Manual audit + note.
- [ ] **POLISH-04** Custom domain (PRD OQ2) + production deploy on a stable URL.
- [ ] **POLISH-05** Full regression: all group test suites green, lint +
  typecheck clean, E2E slice still passes.
- [ ] **POLISH-06** Real game with Christine end-to-end; capture feedback →
  `DECISIONS.md` / next-iteration tasks.

---

## Parallelization notes

- **Do SCAF then SLICE strictly in order** — they define the ground everyone
  stands on.
- After SLICE-13's check-in, **AUTH, GROUP, DRAW, WORD, GUESS, SCORE, NOTIF** are
  independent enough to run in parallel worktrees. Watch the two real coupling
  points: **GROUP depends on AUTH** (needs real users), and anything touching the
  `turn`/`word` schema should land its migration early to avoid merge conflicts.
- Run **Check centrally at each merge join**, and an **independent adversarial
  Review on every merge to the main line** (ROCRLL). Record every real trade-off
  in `DECISIONS.md`.


## Group DESIGN — Approved creative studio redesign → sequential

Source: PRD §14, approved 2026-09-26. Implement and verify in increments; keep
unfinished tasks unchecked. Existing production is Railway/Postgres/Resend;
older Vercel scaffold tasks above are historical and not redesign prerequisites.

- [x] **DESIGN-01** Record the full approved redesign, audience, requirements,
  sequence, privacy constraints, and acceptance criteria in PRD and TASKS.
- [x] **DESIGN-02** Create reviewable hub and drawing studio visual studies for
  desktop (1440px) and phone (390px). Check hierarchy, spacing, and 320px overflow.
- [x] **DESIGN-03** Implement ivory/charcoal/vermilion tokens, Geist typography,
  Roodle wordmark, shared navigation, buttons, fields, cards, focus and reduced
  motion foundations. Verify responsive layout and navigation semantics.
- [x] **DESIGN-04** Build authenticated game hub with one card per friend,
  accurate guess/wait/draw states and direct game links. Test multiple friends,
  recipient isolation, signed-out behavior, and no-games state.
- [x] **DESIGN-05** Show only the user's pending invitations, with expiry-aware
  labels and resend recovery. Test ownership, expired invites, and delivery errors.
  *(Placed on /friends, not the hub — see DECISIONS D14. `listPendingInvites` +
  `inviteExpiryLabel` in `src/auth/invites.ts`; owner-scoped `GET /api/invites`;
  friends page lists invites with expiry labels + per-invite resend. Tests cover
  ownership, expired-but-pending, and 502 delivery errors.)*
- [x] **DESIGN-06** Redesign drawing studio: responsive canvas, grouped palette,
  visual brush sizes, selected tools, recipient/prompt/send hierarchy. Test pointer
  coordinate scaling and existing tools; inspect mobile and desktop rendering.
- [x] **DESIGN-07** Preserve word/stroke drafts independently per friend. Define
  storage lifetime and account isolation; clear sent drafts. Test switching away
  and back, submission failure, success, and sign-out/account changes.
- [x] **DESIGN-08** Polish replay, tactile tiles, wrong/success feedback and
  reduced-motion behavior. Add Draw something back for the correct opponent.
  Test correct, incorrect, give-up, deep links, and keyboard operation.
- [ ] **DESIGN-09** Restyle sign-in, invitations, word packs and scores using
  shared components. Cover loading, empty, error, retry, and success states;
  preserve auth/invite/packs/score regression tests.
- [ ] **DESIGN-10** Add private completed-drawing gallery with words and outcomes,
  secondary scoring, and useful empty states. Test per-game authorization and
  exclusion of pending answers. Reconcile DRAW-07 and SCORE-04 actual completion.
- [ ] **DESIGN-11** Add signed-out introduction and isolated optional sample
  round using labeled fixtures. Test no private data access, game writes, or email.
- [ ] **DESIGN-12** Finish keyboard, contrast, touch-target and reduced-motion
  audit; inspect 320/390/1440px layouts, canvas/replay fidelity, and feedback states.
- [ ] **DESIGN-13** Regression check invites, concurrent games, drafts, drawing,
  replay, guessing, packs, scores; production build, lint/typecheck, deployment
  verification, and real-game feedback. Keep completion evidence below.

### Redesign execution log

- 2026-09-26: Full scope recorded. Starting visual studies, design foundations,
  and game hub. Later phases remain explicitly queued above.

- 2026-09-26, first implementation increment (local, not deployed):
  - DESIGN-02 complete: `docs/design/hub.html` and `drawing.html` provide
    responsive studies with explicitly fictional content. Browser review at
    desktop/390px; 320px overflow checks passed.
  - DESIGN-03 started: semantic palette, Geist font fix, wordmark, navigation,
    cards/buttons, focus and reduced-motion foundations implemented. Shared form
    controls and propagation to remaining screens are still outstanding.
  - DESIGN-04 complete: real private game cards, incoming/waiting counts,
    empty-state invitation, and direct friend/turn links. No answers in hub data.
  - DESIGN-11 started: public introduction implemented; sample round remains.
  - Validation: 8 focused tests passing across hub data, hub component, home,
    and drawing selection; changed-file lint and TypeScript pass; production
    Webpack build passes. Local production homepage → invitation navigation
    verified with no browser console errors. Full regression remains DESIGN-13.
  - Next: pending invitation cards (DESIGN-05), drawing studio (DESIGN-06),
    and independent drafts (DESIGN-07).


- 2026-09-26, phone-first interior redesign:
  - Added shared game-room navigation, safe-area-aware phone tabs, compact room
    headings, form panels, and consistent status/error feedback.
  - Drawing now scales accurately on phones, captures one pointer at a time,
    supports single-tap dots, and keeps send within thumb reach. Undo, eraser,
    palette, and brush sizes have larger targets and explicit selected states.
  - Per-friend word/stroke drafts are page-local: preserved across friend
    switching, cleared on successful send or page unmount. Reload/offline
    persistence remains outside this increment; the UI states this limitation.
  - Guessing uses matching canvas proportions, wrapping tactile tiles,
    reduced-motion replay, and a reply link to the correct game. Failed guesses
    and reveals recover without blocking the controls.
  - Sign-in, invitations, packs, and scores use the new visual system. Remaining
    DESIGN-09 work includes comprehensive packs loading/retry state coverage.
  - Fixed native loading of PGlite's WASM assets so isolated local UI fixtures
    can run through real sign-in and game APIs during browser QA.
  - Browser QA uses fictional local accounts, never production games: verified
    canvas input, separate/restored drafts, long-word wrapping, correct guessing
    and reply routing, and 320/390px phone plus desktop layouts.

  - DESIGN-03/06/07/08 complete for this increment. Component tests cover phone
    coordinate mapping, second-pointer rejection, restoring an initial canvas,
    friend draft restoration, failed sends, account/page isolation, reduced motion,
    keyboard tiles, and reply destinations. Production Webpack build, lint, and
    TypeScript pass. Whole-suite regression is run before publishing.
  - Release validation: all 232 tests across 42 files passed; full lint,
    TypeScript, and production build passed. Phone preview console was clean.
