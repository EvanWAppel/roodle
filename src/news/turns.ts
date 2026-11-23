/**
 * ложь (the news repo) feed, schema 1 (news PRD §20.3, D80): one line per
 * friend saying whose move it is. Built only from hub metadata, so it can
 * never carry a word, stroke data or an email.
 */
import { createHash, timingSafeEqual } from 'node:crypto';
import type { GameCard } from '@/db/hub';

export const NEWS_BASE_URL = 'https://roodle.evanappel.me';
export const MAX_ENTRIES = 20;
const MAX_NAME = 40;

export interface NewsEntry {
  opponent: string;
  turn: 'you' | 'them';
  action: 'guess' | 'draw';
  pending: number | null;
  since: string | null;
  url: string;
}

/** ISO-8601 UTC to the second, e.g. 2026-11-21T14:02:11Z. */
export function isoSeconds(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** A display name safe to publish: never an email, at most 40 chars. */
export function opponentName(displayName: string): string {
  const name = displayName.trim();
  if (!name || name.includes('@')) return 'a friend';
  return name.slice(0, MAX_NAME);
}

function entry(card: GameCard): NewsEntry {
  const opponent = opponentName(card.name);
  if (card.incoming > 0 && card.turnId && card.incomingSince) {
    return {
      opponent,
      turn: 'you',
      action: 'guess',
      pending: card.incoming,
      since: isoSeconds(card.incomingSince),
      url: `${NEWS_BASE_URL}/play?turn=${encodeURIComponent(card.turnId)}`,
    };
  }
  if (card.waiting > 0 && card.waitingSince) {
    return {
      opponent,
      turn: 'them',
      action: 'guess',
      pending: card.waiting,
      since: isoSeconds(card.waitingSince),
      url: `${NEWS_BASE_URL}/play`,
    };
  }
  return {
    opponent,
    turn: 'you',
    action: 'draw',
    pending: null,
    since: null,
    url: `${NEWS_BASE_URL}/draw?game=${encodeURIComponent(card.gameId)}`,
  };
}

/** turn:you first, then oldest since (none last), then name; capped at 20. */
export function newsEntries(cards: GameCard[]): NewsEntry[] {
  return cards
    .map(entry)
    .sort(
      (a, b) =>
        Number(a.turn !== 'you') - Number(b.turn !== 'you') ||
        (a.since ?? '￿').localeCompare(b.since ?? '￿') ||
        a.opponent.localeCompare(b.opponent),
    )
    .slice(0, MAX_ENTRIES);
}

/**
 * Does `Authorization` carry `Bearer <expected>`? Compares SHA-256 digests
 * with timingSafeEqual so neither content nor length leaks through timing.
 * An empty expected token never matches (fail closed when unset).
 */
export function bearerMatches(
  header: string | null,
  expected: string | undefined,
): boolean {
  if (!expected || !header?.startsWith('Bearer ')) return false;
  const digest = (s: string) => createHash('sha256').update(s).digest();
  return timingSafeEqual(digest(header.slice(7)), digest(expected));
}
