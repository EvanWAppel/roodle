# BLOCKED — what I need from Evan

- [ ] 🟡 **Email provider for magic-link sign-in + turn nudges (personal-key guardrail).** The auth mechanism is built and tested, but it can't send real email in production until a provider is wired — and that key goes into a public, deployed app, so it must clear your personal-key checklist first. Steps to unblock:
  1. Create a **dedicated, isolated** email-provider account/workspace for roodle (e.g. Resend) — not your personal/default one.
  2. Mint a **scoped API key** in that workspace, used only by roodle.
  3. Set a **usage cap / alert** (Resend free tier is 3k/mo with no spend by default; on a paid tier add a hard limit).
  4. Add it to Railway: `railway variables --set "RESEND_API_KEY=…" --service roodle-web` (I can run this once you paste the key, or you can), and **confirm it is NOT your personal/default key**.
  Also set the session-signing secret in prod: `railway variables --set "AUTH_SECRET=$(openssl rand -base64 32)" --service roodle-web` (a random app secret, not a personal key). Until this is done, auth stays **built but not enforced** (AUTH-06), so the live app keeps working via the dev player-switch.

<!-- Only open `- [ ]` items are mirrored into Evan's todo dashboard. -->
