// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '@/db/testDb';
import type { DB } from '@/db/client';
import { users, invites } from '@/db/schema';
import { areFriends, findGameForPair } from '@/db/friends';
import { hashToken } from './tokens';
import {
  createInvite,
  acceptInvite,
  DuplicateInviteError,
  InviteEmailMismatchError,
} from './invites';

async function makeUser(db: DB, email: string, displayName: string) {
  const [u] = await db.insert(users).values({ email, displayName }).returning();
  return u;
}

describe('invites service (GROUP-02 / GROUP-03)', () => {
  let db: DB;
  beforeEach(async () => {
    db = await createTestDb();
  });

  describe('createInvite', () => {
    it('creates a pending invite storing only the token hash', async () => {
      const inviter = await makeUser(db, 'inviter@example.com', 'Inviter');
      const { token, invite } = await createInvite(db, inviter.id, 'FRIEND@Example.com');
      expect(token).toBeTruthy();
      expect(invite.status).toBe('pending');
      expect(invite.inviteeEmail).toBe('friend@example.com'); // lowercased
      // Stored value is the hash, never the raw token.
      expect(invite.tokenHash).toBe(hashToken(token));
      expect(invite.tokenHash).not.toBe(token);
    });

    it('rejects a duplicate pending invite from the same inviter to the same email', async () => {
      const inviter = await makeUser(db, 'inviter@example.com', 'Inviter');
      await createInvite(db, inviter.id, 'friend@example.com');
      await expect(
        createInvite(db, inviter.id, 'friend@example.com'),
      ).rejects.toBeInstanceOf(DuplicateInviteError);
    });

    it('rejects an invalid email', async () => {
      const inviter = await makeUser(db, 'inviter@example.com', 'Inviter');
      await expect(createInvite(db, inviter.id, 'not-an-email')).rejects.toThrow(
        /invalid email/,
      );
    });
  });

  describe('acceptInvite', () => {
    it('links the two users: friendship + game exist, invite marked accepted', async () => {
      const inviter = await makeUser(db, 'inviter@example.com', 'Inviter');
      const invitee = await makeUser(db, 'friend@example.com', 'Friend');
      const { token } = await createInvite(db, inviter.id, invitee.email);

      const result = await acceptInvite(db, token, invitee);
      expect(result.friendship).toBeTruthy();
      expect(result.game).toBeTruthy();

      expect(await areFriends(db, inviter.id, invitee.id)).toBe(true);
      expect(await findGameForPair(db, inviter.id, invitee.id)).toBeTruthy();

      const [row] = await db
        .select()
        .from(invites)
        .where(eq(invites.tokenHash, hashToken(token)));
      expect(row.status).toBe('accepted');
      expect(row.acceptedByUserId).toBe(invitee.id);
    });

    it('rejects an expired token', async () => {
      const inviter = await makeUser(db, 'inviter@example.com', 'Inviter');
      const invitee = await makeUser(db, 'friend@example.com', 'Friend');
      // Issue it 8 days ago so its 7-day expiry is now in the past.
      const past = Date.now() - 8 * 24 * 60 * 60 * 1000;
      const { token } = await createInvite(db, inviter.id, invitee.email, past);
      await expect(acceptInvite(db, token, invitee)).rejects.toThrow(/expired/);
    });

    it('rejects an unknown token', async () => {
      const invitee = await makeUser(db, 'friend@example.com', 'Friend');
      await expect(acceptInvite(db, 'bogus', invitee)).rejects.toThrow(
        /invalid/,
      );
    });

    it('rejects a user whose email is not the one the invite was sent to', async () => {
      const inviter = await makeUser(db, 'inviter@example.com', 'Inviter');
      const invitee = await makeUser(db, 'friend@example.com', 'Friend');
      const mallory = await makeUser(db, 'mallory@example.com', 'Mallory');
      const { token } = await createInvite(db, inviter.id, invitee.email);

      // Mallory holds the token but it wasn't addressed to her — reject, and
      // don't friend her to the inviter.
      await expect(acceptInvite(db, token, mallory)).rejects.toBeInstanceOf(
        InviteEmailMismatchError,
      );
      expect(await areFriends(db, inviter.id, mallory.id)).toBe(false);
      expect(await areFriends(db, inviter.id, invitee.id)).toBe(false);
    });

    it('is idempotent: re-accepting creates no duplicates and does not crash', async () => {
      const inviter = await makeUser(db, 'inviter@example.com', 'Inviter');
      const invitee = await makeUser(db, 'friend@example.com', 'Friend');
      const { token } = await createInvite(db, inviter.id, invitee.email);

      const first = await acceptInvite(db, token, invitee);
      const second = await acceptInvite(db, token, invitee);
      expect(second.friendship.id).toBe(first.friendship.id);
      expect(second.game.id).toBe(first.game.id);

      const allFriends = await db.select().from(invites);
      expect(allFriends).toHaveLength(1);
    });
  });
});
