import type { Drawing } from './strokes';

export interface SessionInfo {
  me: { id: string; displayName: string };
  opponent: { id: string; displayName: string };
  gameId: string;
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

export function fetchSession(as: string): Promise<SessionInfo> {
  return fetch(`/api/session?as=${encodeURIComponent(as)}`).then(json<SessionInfo>);
}

export function submitTurn(input: {
  gameId: string;
  drawerId: string;
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
