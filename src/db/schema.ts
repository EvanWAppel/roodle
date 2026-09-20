import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
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

export type User = typeof users.$inferSelect;
export type Game = typeof games.$inferSelect;
export type Turn = typeof turns.$inferSelect;
export type NewTurn = typeof turns.$inferInsert;
