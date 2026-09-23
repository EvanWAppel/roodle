/**
 * NOTIF-03/04/05: turn-nudge sending.
 *
 * When a turn becomes someone's move, email the guesser a deep link that opens
 * the pending turn (`/play?turn=<id>`). Respects each user's `notify_enabled`
 * opt-out. Send failures are surfaced to the caller — never swallowed — so the
 * calling route can decide how to react (see the route wiring for the policy).
 */
import { eq } from 'drizzle-orm';
import type { DB } from '@/db/client';
import { users, type Turn } from '@/db/schema';
import { defaultTransport, type EmailTransport } from '@/auth/email';

/** Build the deep link that opens a specific pending turn on the play page. */
export function turnDeepLink(base: string, turnId: string): string {
  return `${base}/play?turn=${turnId}`;
}

/**
 * NOTIF-05: set a user's turn-nudge opt-in flag. Returns the new value.
 * Throws if the user does not exist (never swallow a missing update).
 */
export async function setNotifyEnabled(
  db: DB,
  userId: string,
  enabled: boolean,
): Promise<boolean> {
  const [row] = await db
    .update(users)
    .set({ notifyEnabled: enabled })
    .where(eq(users.id, userId))
    .returning();

  if (!row) {
    throw new Error(`setNotifyEnabled: user not found: ${userId}`);
  }
  return row.notifyEnabled;
}

/**
 * Nudge the guesser of a turn that it's their move.
 *
 * Looks up the guesser's email + notify preference; if they have opted out
 * (`notify_enabled = false`) no email is sent and the function returns false.
 * Otherwise it sends exactly one nudge and returns true.
 *
 * Errors (missing guesser, transport failure) propagate — callers must not
 * swallow them.
 */
export async function nudgeGuesser(
  db: DB,
  turn: Turn,
  base: string,
  transport: EmailTransport = defaultTransport(),
): Promise<boolean> {
  const [guesser] = await db
    .select()
    .from(users)
    .where(eq(users.id, turn.guesserId))
    .limit(1);

  if (!guesser) {
    throw new Error(`nudgeGuesser: guesser not found: ${turn.guesserId}`);
  }

  if (!guesser.notifyEnabled) {
    return false;
  }

  await transport.sendNudge({
    to: guesser.email,
    url: turnDeepLink(base, turn.id),
  });
  return true;
}
