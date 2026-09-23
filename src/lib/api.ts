import type { Drawing } from './strokes';

export interface Person {
  id: string;
  displayName: string;
}

export interface FriendInfo {
  opponent: Person;
  gameId: string;
}

/** Shape of GET /api/auth/session. `me` is null when signed out. */
export interface AuthSession {
  me: Person | null;
  friends: FriendInfo[];
}

export interface TurnDTO {
  id: string;
  gameId: string;
  drawerId: string;
  guesserId: string;
  word: string;
  strokes: Drawing;
  status: 'awaiting_guess' | 'guessed' | 'gave_up';
  pointsAwarded: number;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`request failed: ${res.status}`);
  return (await res.json()) as T;
}

export function fetchAuthSession(): Promise<AuthSession> {
  return fetch('/api/auth/session').then(json<AuthSession>);
}

export function submitTurn(input: {
  gameId: string;
  guesserId: string;
  word: string;
  strokes: Drawing;
}): Promise<TurnDTO> {
  return fetch('/api/turns', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  }).then(json<TurnDTO>);
}

export function fetchPending(guesserId: string): Promise<TurnDTO[]> {
  return fetch(`/api/turns?for=${encodeURIComponent(guesserId)}`).then(
    json<TurnDTO[]>,
  );
}

export function submitGuess(turnId: string, guess: string): Promise<TurnDTO> {
  return fetch(`/api/turns/${turnId}/guess`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ guess }),
  }).then(json<TurnDTO>);
}

export function giveUp(turnId: string): Promise<TurnDTO> {
  return fetch(`/api/turns/${turnId}/guess`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'give_up' }),
  }).then(json<TurnDTO>);
}

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface NewPackWord {
  text: string;
  difficulty: Difficulty;
}

/** Create a custom word pack (WORD-04/06). Returns the new pack id. */
export function createCustomPack(input: {
  name: string;
  words: NewPackWord[];
}): Promise<{ ok: true; packId: string }> {
  return fetch('/api/packs', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  }).then(json<{ ok: true; packId: string }>);
}

export interface NextWordResult {
  word: string;
  difficulty: Difficulty;
  /** 'pack' when drawn from an enabled pack; 'builtin' when it fell back. */
  source: 'pack' | 'builtin';
}

/**
 * Fetch the next word to draw for a game, honoring that game's enabled packs
 * and difficulty (WORD-03). Server-side selection replaces the client-side
 * `pickRandomWord` for pack-aware games; see route for fallback behavior.
 */
export function fetchNextWord(input: {
  gameId: string;
  difficulty?: Difficulty;
  exclude?: string;
}): Promise<NextWordResult> {
  const qs = new URLSearchParams({ game: input.gameId });
  if (input.difficulty) qs.set('difficulty', input.difficulty);
  if (input.exclude) qs.set('exclude', input.exclude);
  return fetch(`/api/words/next?${qs.toString()}`).then(json<NextWordResult>);
}

export interface GamePackToggle {
  id: string;
  name: string;
  isBuiltin: boolean;
  enabled: boolean;
}

/** List a game's packs with enabled flags (WORD-06). */
export function fetchGamePacks(gameId: string): Promise<GamePackToggle[]> {
  return fetch(`/api/games/${gameId}/packs`)
    .then(json<{ packs: GamePackToggle[] }>)
    .then((r) => r.packs);
}

/** Enable or disable a pack for a game (WORD-05/06). */
export function setGamePackEnabled(
  gameId: string,
  packId: string,
  enabled: boolean,
): Promise<{ ok: true }> {
  return fetch(`/api/games/${gameId}/packs`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ packId, enabled }),
  }).then(json<{ ok: true }>);
}
