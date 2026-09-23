/**
 * Friend-invite service. Mirrors the magic-link flow: issue a token (store only
 * its hash + expiry), email a link, and on accept create the friendship + game
 * between inviter and invitee. Errors are surfaced, never swallowed.
 */
import { and, eq } from 'drizzle-orm';
import type { DB } from '@/db/client';
import { invites, type Invite, type Friendship, type Game } from '@/db/schema';
import { generateToken, hashToken } from './tokens';
import { normalizeEmail } from './service';
import { ensureFriendship, ensureGameForPair } from '@/db/friends';

export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** A pending invite from this inviter to this email already exists. */
export class DuplicateInviteError extends Error {
  constructor() {
    super('duplicate pending invite');
    this.name = 'DuplicateInviteError';
  }
}

/**
 * The signed-in user accepting the invite is not the person it was addressed to.
 * Invites are bearer tokens sent to a specific email; only that email may claim
 * them, so a leaked/forwarded link can't hijack the friendship.
 */
export class InviteEmailMismatchError extends Error {
  constructor() {
    super('invite addressed to a different email');
    this.name = 'InviteEmailMismatchError';
  }
}

/**
 * Issue a friend invite. Stores only the token hash; returns the raw token for
 * the caller to build the accept link. Throws on invalid email, or
 * DuplicateInviteError when a pending invite to the same email already exists.
 */
export async function createInvite(
  db: DB,
  inviterId: string,
  email: string,
  now: number = Date.now(),
): Promise<{ token: string; invite: Invite }> {
  const inviteeEmail = normalizeEmail(email);
  if (!EMAIL_RE.test(inviteeEmail)) throw new Error('invalid email');

  const [dup] = await db
    .select({ id: invites.id })
    .from(invites)
    .where(
      and(
        eq(invites.inviterId, inviterId),
        eq(invites.inviteeEmail, inviteeEmail),
        eq(invites.status, 'pending'),
      ),
    )
    .limit(1);
  if (dup) throw new DuplicateInviteError();

  const token = generateToken();
  const [invite] = await db
    .insert(invites)
    .values({
      inviterId,
      inviteeEmail,
      tokenHash: hashToken(token),
      status: 'pending',
      expiresAt: new Date(now + INVITE_TTL_MS),
    })
    .returning();
  return { token, invite };
}

export interface AcceptResult {
  invite: Invite;
  friendship: Friendship;
  game: Game;
}

/**
 * Accept an invite by raw token for the accepting user. Validates the token
 * (exists, not expired) and that the accepting user's email matches the address
 * the invite was sent to, then creates the friendship + game if absent and marks
 * the invite accepted. Idempotent: re-accepting an already-accepted invite
 * returns the same friendship + game without creating duplicates. Throws a clear
 * error for an unknown/invalid or expired token, or an email mismatch.
 */
export async function acceptInvite(
  db: DB,
  rawToken: string,
  acceptingUser: { id: string; email: string },
  now: number = Date.now(),
): Promise<AcceptResult> {
  const hash = hashToken(rawToken);
  const [invite] = await db
    .select()
    .from(invites)
    .where(eq(invites.tokenHash, hash))
    .limit(1);
  if (!invite) throw new Error('invalid invite token');

  if (invite.status === 'expired' || invite.expiresAt.getTime() < now) {
    // Reflect expiry in the row if not already, then reject.
    if (invite.status === 'pending') {
      await db
        .update(invites)
        .set({ status: 'expired' })
        .where(eq(invites.id, invite.id));
    }
    throw new Error('invite expired');
  }

  // Bind the invite to its addressee: only the invited email may claim it, so a
  // leaked link can't friend a stranger to the inviter.
  if (normalizeEmail(acceptingUser.email) !== invite.inviteeEmail) {
    throw new InviteEmailMismatchError();
  }

  // Friendship + game are between the inviter and the accepting user. Both
  // ensure* calls are idempotent, so re-accepting is safe.
  const friendship = await ensureFriendship(db, invite.inviterId, acceptingUser.id);
  const game = await ensureGameForPair(db, invite.inviterId, acceptingUser.id);

  let accepted = invite;
  if (invite.status !== 'accepted') {
    const [row] = await db
      .update(invites)
      .set({ status: 'accepted', acceptedByUserId: acceptingUser.id })
      .where(eq(invites.id, invite.id))
      .returning();
    accepted = row;
  }

  return { invite: accepted, friendship, game };
}
