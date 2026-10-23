# Roodle

A small, private, ad-free draw-and-guess game for friends. Think async Pictionary
with no ads, no coins and no upsells.

One friend draws a word. Later, the other opens the app, watches the drawing
replay stroke by stroke, and guesses it by tapping letter tiles. Roodle was built
for Evan, Christine and a few friends.

Live at https://roodle.evanappel.me.

Features: magic-link sign-in, friend invites, a drawing studio, replay with
letter-tile guessing, word packs (built-in and custom), scores, a gallery of
finished drawings, email turn nudges, and a signed-out sample round at `/try`.

See [PRD.md](PRD.md) for the product spec, [TASKS.md](TASKS.md) for the build
plan and [DECISIONS.md](DECISIONS.md) for the decision log.

## Stack

- Next.js 16 (App Router), React 19, Tailwind CSS 4
- Drizzle ORM. Dev and tests use [PGlite](https://pglite.dev), an in-process
  Postgres. Production uses a real Postgres reached through `DATABASE_URL`.
- Resend for email, called over its REST API with no SDK
- Vitest and Testing Library

## Local development

You need Node (CI uses 24) and npm. You don't need a database server: without
`DATABASE_URL`, the app opens a file-backed PGlite in `./.pglite` (gitignored).

```bash
npm ci
npm run dev        # http://localhost:3000
```

On first access the app applies every migration in `drizzle/` and seeds the
built-in word packs. To start from a clean database, stop the server and delete
`./.pglite`.

**Signing in locally.** If `RESEND_API_KEY` and `EMAIL_FROM` aren't set, no email
is sent. The server logs each magic link, invite link and turn nudge to its
console instead, like `[roodle] magic link for you@example.com: http://…`.
Open that URL to sign in.

> Next.js 16 differs from older versions. Read `node_modules/next/dist/docs/`
> before changing app code (see [AGENTS.md](AGENTS.md)).

## Scripts

| Command                | What it does                                                 |
| ---------------------- | ------------------------------------------------------------ |
| `npm run dev`          | Dev server with hot reload                                   |
| `npm run build`        | Production build                                             |
| `npm run start`        | Serve the production build (`next start`)                    |
| `npm run lint`         | ESLint                                                       |
| `npm run typecheck`    | `next typegen && tsc --noEmit` (generates route types first) |
| `npm run test`         | Vitest in watch mode                                         |
| `npm run test:run`     | Full test suite, once (what CI runs)                         |
| `npm run format`       | Prettier: write                                              |
| `npm run format:check` | Prettier: check only                                         |

To run a single test file, use `npx vitest run src/lib/guess.test.ts`.

Tests need no database or network. Each DB-backed test gets a fresh in-memory
PGlite, loaded from one migrated template per run (see DECISIONS D17).

CI (`.github/workflows/ci.yml`) runs lint, typecheck and the test suite on every
pull request and on every push to `main`.

## Environment variables

These are all the variables the code reads. **Every one is optional for local
dev.** Only the names are listed here. Never commit values.

| Variable         | Read in               | Purpose                                                                                                                                                                |
| ---------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`   | `src/db/client.ts`    | Postgres connection string. When set, the app uses postgres-js instead of PGlite and runs migrations on first boot.                                                    |
| `PGLITE_PATH`    | `src/db/client.ts`    | Directory for the local PGlite data. Defaults to `./.pglite`. Ignored when `DATABASE_URL` is set.                                                                      |
| `AUTH_SECRET`    | `src/auth/session.ts` | HMAC key for the session cookie. **Required in production.** The app throws without it. Dev falls back to an insecure built-in secret.                                 |
| `APP_URL`        | `src/lib/baseUrl.ts`  | Canonical public origin for links in emails and for redirects, e.g. `https://roodle.evanappel.me`. Set it in production. Without it the app trusts `x-forwarded-host`. |
| `RESEND_API_KEY` | `src/auth/email.ts`   | Resend API key. With `EMAIL_FROM`, it turns on real email. Without both, links are logged to the console.                                                              |
| `EMAIL_FROM`     | `src/auth/email.ts`   | Sender address for Resend, on a verified domain.                                                                                                                       |

## Database and migrations

- The schema is in `src/db/schema.ts`. Drizzle Kit config is in `drizzle.config.ts`.
- SQL migrations live in `drizzle/` (`0000_init.sql` …), with Drizzle's journal
  in `drizzle/meta/`. The app applies them on startup, in both PGlite and Postgres
  mode. There is no separate migrate step.
- After changing the schema, generate a new migration and commit it:

  ```bash
  npx drizzle-kit generate
  ```

## Deployment

Roodle runs on **Railway**, not Vercel. See [DECISIONS.md](DECISIONS.md) **D7**.
In short:

- The app service `roodle-web` runs `npm run build` then `npm run start`.
- A Railway Postgres add-on provides `DATABASE_URL` through a service reference.
  Migrations and built-in pack seeding run on first boot.
- Set `AUTH_SECRET` and `APP_URL` on the service.
- Email goes through Resend with a dedicated, revocable `roodle` key, sent from a
  verified domain. See **D9** for the account trade-off and the rate limits on
  `/api/auth/request`.

Production URLs: https://roodle.evanappel.me (custom domain) and
https://roodle-web-production.up.railway.app.
