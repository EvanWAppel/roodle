import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  unique,
  boolean,
} from 'drizzle-orm/pg-core';
import type { Drawing } from '@/lib/strokes';

/** Players. Slice seeds two; AUTH group later fills this via magic-link. */
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  displayName: text('display_name').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

/** An ongoing match between two players (a chain of alternating turns). */
export const games = pgTable('games', {
  id: uuid('id').primaryKey().defaultRandom(),
  playerA: uuid('player_a')
    .notNull()
    .references(() => users.id),
  playerB: uuid('player_b')
    .notNull()
    .references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type TurnStatus = 'awaiting_guess' | 'guessed' | 'gave_up';

/** One drawing submitted by the drawer for the guesser to solve. */
export const turns = pgTable('turns', {
  id: uuid('id').primaryKey().defaultRandom(),
  gameId: uuid('game_id')
    .notNull()
    .references(() => games.id),
  drawerId: uuid('drawer_id')
    .notNull()
    .references(() => users.id),
  guesserId: uuid('guesser_id')
    .notNull()
    .references(() => users.id),
  word: text('word').notNull(),
  strokes: jsonb('strokes').notNull().$type<Drawing>(),
  status: text('status').notNull().$type<TurnStatus>().default('awaiting_guess'),
  pointsAwarded: integer('points_awarded').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at'),
});

/** Single-use, expiring magic-link tokens (only the hash is stored). */
export const authTokens = pgTable('auth_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type InviteStatus = 'pending' | 'accepted' | 'expired';

/**
 * A friend invitation addressed to an email. Only the token hash is stored
 * (same scheme as magic-link tokens); the raw token lives only in the emailed
 * link. Accepting one creates a friendship + game between the two users.
 */
export const invites = pgTable('invites', {
  id: uuid('id').primaryKey().defaultRandom(),
  inviterId: uuid('inviter_id')
    .notNull()
    .references(() => users.id),
  inviteeEmail: text('invitee_email').notNull(),
  tokenHash: text('token_hash').notNull(),
  status: text('status').notNull().$type<InviteStatus>().default('pending'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at').notNull(),
  acceptedByUserId: uuid('accepted_by_user_id').references(() => users.id),
});

/**
 * A symmetric friendship between two users. Stored once per pair with a
 * canonical ordering (userAId < userBId as strings), enforced unique so a
 * pair can't be duplicated in either order.
 */
export const friendships = pgTable(
  'friendships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userAId: uuid('user_a_id')
      .notNull()
      .references(() => users.id),
    userBId: uuid('user_b_id')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [unique('friendships_pair_unique').on(t.userAId, t.userBId)],
);

export type Difficulty = 'easy' | 'medium' | 'hard';

/**
 * A word pack: a named collection of words. Built-in packs (isBuiltin=true) are
 * curated and have no owner; custom packs (WORD-04) are owned by the user who
 * created them. Difficulty lives on each word, not the pack, so a pack can mix.
 */
export const packs = pgTable('packs', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  ownerId: uuid('owner_id').references(() => users.id),
  isBuiltin: boolean('is_builtin').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

/** A single word in a pack, tagged with a difficulty. */
export const words = pgTable('words', {
  id: uuid('id').primaryKey().defaultRandom(),
  packId: uuid('pack_id')
    .notNull()
    .references(() => packs.id),
  text: text('text').notNull(),
  difficulty: text('difficulty').notNull().$type<Difficulty>().default('medium'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

/**
 * Which packs are enabled for a game (WORD-05). Absence of any row for a game
 * means "all packs enabled" (the default); once a row exists, only the enabled
 * packs are drawn from. Enabled is stored explicitly so a pack can be toggled
 * off without deleting the association.
 */
export const gamePacks = pgTable(
  'game_packs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id),
    packId: uuid('pack_id')
      .notNull()
      .references(() => packs.id),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [unique('game_packs_pair_unique').on(t.gameId, t.packId)],
);

export type User = typeof users.$inferSelect;
export type Pack = typeof packs.$inferSelect;
export type NewPack = typeof packs.$inferInsert;
export type Word = typeof words.$inferSelect;
export type NewWord = typeof words.$inferInsert;
export type GamePack = typeof gamePacks.$inferSelect;
export type Invite = typeof invites.$inferSelect;
export type Friendship = typeof friendships.$inferSelect;
export type AuthToken = typeof authTokens.$inferSelect;
export type Game = typeof games.$inferSelect;
export type Turn = typeof turns.$inferSelect;
export type NewTurn = typeof turns.$inferInsert;
