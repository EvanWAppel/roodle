# Roodle — Product Requirements Document

**Status:** Draft (interview complete, awaiting sign-off)
**Author:** Evan Appel (with Claude)
**Last updated:** 2026-09-20

---

## 1. Summary

Roodle is a small, private, ad-free, microtransaction-free drawing-and-guessing
game — the "Draw Something" experience without the ads, coin shops, and
upsells that Christine dislikes. Two-to-a-few friends take turns: one person
draws a word; the other opens the app later, watches the drawing replay, and
guesses it by tapping letter tiles. It is deliberately simple, cozy, and
built for people who already know each other.

**One-line pitch:** async Pictionary for friends, no ads, no coins, no nonsense.

### Origin
Christine wants to play Draw / Pictionary with Evan but dislikes the ads and
microtransactions in existing apps. Roodle is a purpose-built, private
alternative for the two of them (and a few friends).

---

## 2. Goals & non-goals

### Goals
- **G1.** Let a small, fixed group of friends play asynchronous draw-and-guess
  at their own pace.
- **G2.** Zero ads, zero microtransactions, zero dark patterns — ever. This is
  the whole reason the project exists.
- **G3.** Delightful, low-friction drawing and guessing on both phone and
  desktop browsers.
- **G4.** Faithful "watch the drawing replay, then guess with letter tiles"
  core loop.
- **G5.** Gentle re-engagement via an email nudge when it's your turn.
- **G6.** Serve as a polished portfolio piece (clean code, tests, deployed).

### Non-goals (v1)
- **NG1.** No public lobbies, matchmaking, or open sign-ups. Invite-only.
- **NG2.** No live/real-time simultaneous rooms (skribbl-style). Async only.
- **NG3.** No monetization of any kind — no ads, no coins, no shop, no premium
  tier.
- **NG4.** No mobile native apps (installable PWA is a possible later nicety,
  not v1).
- **NG5.** No social graph, feeds, likes, or discovery.
- **NG6.** No AI-generated drawings or AI opponents.

---

## 3. Decisions locked in the interview

| Area | Decision |
|---|---|
| **Session model** | **Async turns** (Draw Something-style). No simultaneous live rooms. |
| **Audience** | **Small private groups** — you two plus a few invited friends. Invite-only, no public play. |
| **Words** | **Built-in word packs + custom packs** (inside jokes / your own words). |
| **Notifications** | **Email nudge** when it's your turn to guess (or draw). |
| **Guessing UX** | **Letter tiles** — scrambled letters tapped into blanks, Draw Something-style. |
| **Scoring** | **Points + stats** — points per correct guess, a scoreboard and history. No purchasable currency. |
| **Identity / auth** | **Magic-link email** — enter email, click link, no passwords. Pairs with the email nudges. |

---

## 4. Personas

- **Christine (the reason).** Plays casually on her phone. Wants fun, not a
  storefront. Motivated by the shared back-and-forth, not leaderboards.
- **Evan (the builder + player).** Plays on phone and desktop. Also cares that
  the codebase is clean and deployable as a portfolio piece.
- **A few friends.** Invited by email. Same casual, private experience.

---

## 5. Core game loop

```
1. It's your turn to DRAW.
   - App offers a choice of words (from an enabled pack), at a difficulty.
   - You draw on the canvas. Every stroke is captured as vector data.
   - You submit. The drawing + word are stored; the recipient is emailed.

2. It's the other person's turn to GUESS.
   - They open the app, see pending drawings addressed to them.
   - They watch the drawing REPLAY (strokes animate in the order drawn).
   - They guess by tapping LETTER TILES into blanks (scrambled letters).
   - Correct  -> points awarded, turn passes back (they now draw).
   - Give up   -> word revealed, no points, turn passes back.

3. Repeat, at each player's own pace. A shared scoreboard + history accrues.
```

A "game" between two players is an ongoing, alternating chain of turns (like a
long-running match), not a one-off round.

---

## 6. Functional requirements

### 6.1 Accounts & identity
- **FR-A1.** Sign in via magic-link email (enter email → receive link → click →
  signed in). No passwords.
- **FR-A2.** A profile has: display name, email, avatar (optional, later), and
  stats.
- **FR-A3.** Sessions persist across visits on the same device; re-auth by
  magic link when expired.

### 6.2 Groups & invites
- **FR-G1.** Invite-only. A player invites a friend by entering their email;
  the friend gets an invite link and joins on first magic-link sign-in.
- **FR-G2.** Players belong to a private group / friend list; you can only start
  a game with someone you're connected to.
- **FR-G3.** No public directory, no discoverability.

### 6.3 Drawing
- **FR-D1.** Canvas drawing that works with touch (phone) and mouse (desktop).
- **FR-D2.** Basic tools: a few brush sizes, a color palette, an eraser, undo,
  and clear.
- **FR-D3.** Strokes are captured as **ordered vector paths** (points + tool +
  color + width), not just a flat bitmap, so the guesser can watch a replay.
- **FR-D4.** The drawer picks a word from an offered set before drawing.
- **FR-D5.** Submit sends the drawing to exactly one recipient (the other player
  in that game).

### 6.4 Words & packs
- **FR-W1.** Ship curated **built-in packs** with categories and difficulty
  (e.g. Easy/Medium/Hard; Animals, Food, Movies, etc.).
- **FR-W2.** Users can create **custom packs** (name + word list) and enable
  them per game (inside jokes, shared references).
- **FR-W3.** Word offered to the drawer is chosen at random from enabled packs
  at the chosen difficulty.

### 6.5 Guessing
- **FR-U1.** Show the drawing as an animated **replay** (strokes in draw order),
  with a control to replay again or jump to the final frame.
- **FR-U2.** Present blanks for the word and a tray of **scrambled letter
  tiles** (correct letters + a few decoys, Draw Something-style).
- **FR-U3.** Tapping a tile fills the next blank; tapping a filled blank clears
  it. When the blanks spell the word, it's correct.
- **FR-U4.** A **give up / reveal** action ends the guess, reveals the word, and
  awards no points.
- **FR-U5.** (Optional, later) hint mechanic — reveal one letter.

### 6.6 Scoring & stats
- **FR-S1.** Award points for a correct guess (base points; optionally scaled by
  difficulty). No currency, nothing purchasable.
- **FR-S2.** Maintain a per-game scoreboard and a per-player lifetime stats page
  (games played, correct guesses, current/longest streak, points).
- **FR-S3.** Show a per-game history: past drawings, words, who guessed what,
  outcomes. (Past drawings viewable as a little gallery.)

### 6.7 Notifications
- **FR-N1.** Send an **email nudge** when it becomes a player's turn ("Christine
  drew something — come guess!" / "Evan guessed — your turn to draw!").
- **FR-N2.** Emails include a deep link straight into the pending turn.
- **FR-N3.** Per-user notification toggle + unsubscribe. No spam; at most one
  nudge per pending turn (no repeated reminders in v1).

---

## 7. Non-functional requirements

- **NFR-1. No ads / no microtransactions / no tracking-for-ads.** Absolute
  product constraint.
- **NFR-2. Privacy.** Private by default; drawings and words are visible only to
  the two players in a game. Minimal data collection (email + gameplay).
- **NFR-3. Mobile-first responsive.** Phone is the primary drawing/guessing
  surface; desktop fully supported.
- **NFR-4. Low cost to run.** Small private app; hosting/DB/email should sit in
  free or near-free tiers.
- **NFR-5. Accessible.** Reasonable color contrast, tap target sizes, keyboard
  support for guessing on desktop.
- **NFR-6. Data durability.** Drawings and scores persist reliably; no silent
  data loss.
- **NFR-7. Portfolio quality.** Tested, linted, typechecked, cleanly deployed.

---

## 8. Proposed technical approach

> This section is a **proposed** default aligned with Evan's standing
> preference (TS/Next.js frontends on Vercel under `evanappel.me`; see
> portfolio memory). It is a decision to confirm, not settle — flagged in
> DECISIONS.md and open to change.

- **Framework:** Next.js (App Router) in TypeScript.
- **Hosting:** Vercel (stable production domain, not per-deploy URLs).
- **Auth:** Magic-link email via an auth library (e.g. Auth.js/NextAuth email
  provider) or a Vercel Marketplace auth integration.
- **Database:** Postgres via the Vercel Marketplace (e.g. Neon). Stores users,
  groups/invites, games, turns, drawings (stroke vector JSON), words/packs,
  scores/stats.
- **Drawing storage:** strokes as JSON vector data (arrays of points with tool,
  color, width) to enable replay; optionally a rendered thumbnail for galleries.
- **Email:** a transactional email provider (e.g. Resend) for magic links and
  turn nudges.
- **Canvas:** HTML5 `<canvas>` with pointer events; a thin stroke-recording
  layer.

### Open technical questions (to resolve before/early in build)
- **TQ1.** Auth provider: Auth.js email provider vs a Marketplace auth
  integration — pick one.
- **TQ2.** Email provider choice and sender domain (needs a verified domain for
  deliverability).
- **TQ3.** Exact Postgres provider on the Vercel Marketplace.
- **TQ4.** Stroke data schema + size budget (how much drawing detail to retain).

---

## 9. Data model (first sketch)

- **User** — id, email, display_name, avatar, created_at, notify_enabled.
- **Group / Friendship** — connects users who may play together; invite records
  (inviter, invitee_email, token, status).
- **Pack** — id, name, owner (null for built-in), is_builtin.
- **Word** — id, pack_id, text, difficulty.
- **Game** — id, player_a, player_b, created_at, status; running scores.
- **Turn** — id, game_id, drawer_id, guesser_id, word_id, strokes (JSON),
  status (awaiting_guess / guessed / gave_up), points_awarded, created_at,
  resolved_at.
- **Stats** (derivable or materialized) — per user: games, correct guesses,
  streak, points.

---

## 10. Out of scope (v1) / possible later

- Live/simultaneous rooms (skribbl-style).
- Public lobbies, matchmaking, open sign-up.
- Web-push notifications (email-only in v1; push is a later option).
- Installable PWA polish, offline drafts.
- Groups larger than a handful; group games with >2 players in one chain.
- Hints, reactions/comments on drawings, avatars/theming.
- Any monetization (permanently out of scope by design).

---

## 11. Success criteria

- **SC-1.** Evan and Christine can play a full async chain of turns end-to-end,
  on their phones, with email nudges working.
- **SC-2.** Zero ads / zero purchase prompts anywhere in the experience.
- **SC-3.** Drawing replay is smooth and readable; letter-tile guessing feels
  like Draw Something.
- **SC-4.** Deployed to a stable URL with auth, DB, and email all live.
- **SC-5.** Christine prefers it to the ad-laden app she was using. (The real
  bar.)

---

## 12. Milestones (rough)

1. **M0 — Scaffold & decisions.** Next.js app on Vercel, Postgres + email
   provisioned, DECISIONS.md seeded, TASKS.md drafted. BLOCKED.md standing.
2. **M1 — Auth & groups.** Magic-link sign-in; invite a friend by email.
3. **M2 — Draw & submit.** Canvas + tools; stroke capture; word selection;
   submit a turn.
4. **M3 — Replay & guess.** Stroke replay; letter-tile guessing; correct /
   give-up outcomes.
5. **M4 — Scoring & stats.** Points, scoreboard, per-player stats, history
   gallery.
6. **M5 — Nudges & polish.** Email turn nudges, notification prefs, mobile
   polish, tests/lint/typecheck green.
7. **M6 — Ship.** Deploy, play a real game with Christine, iterate.

---

## 13. Open questions for Evan

- **OQ1.** Confirm the Next.js-on-Vercel stack (§8) — or prefer something else?
- **OQ2.** Custom domain under `evanappel.me` (e.g. `roodle.evanappel.me`) or a
  standalone domain?
- **OQ3.** Points formula — flat per correct guess, or scaled by difficulty /
  speed?
- **OQ4.** Should a game be strictly 1:1 chains, or can you have several
  concurrent games with different friends?
- **OQ5.** How much drawing fidelity to preserve (affects stroke-data size /
  replay smoothness)?
- **OQ6.** Any content/word filtering needed for custom packs, or fully trusted
  (private friends)?
```
