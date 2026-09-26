import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { AuthSession, TurnDTO } from '@/lib/api';

// Router: /play redirects to /signin when signed out; stub replace.
const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));

// Stub the data layer; each test sets the session + pending turns.
const fetchAuthSession = vi.fn<() => Promise<AuthSession>>();
const fetchPending = vi.fn<(g: string) => Promise<TurnDTO[]>>();
vi.mock('@/lib/api', () => ({
  fetchAuthSession: () => fetchAuthSession(),
  fetchPending: (g: string) => fetchPending(g),
  submitGuess: vi.fn(),
  giveUp: vi.fn(),
}));

// Trivial stubs so the active view is observable without canvas/tile internals.
vi.mock('@/components/DrawingReplay', () => ({
  DrawingReplay: () => <div data-testid="replay" />,
}));
vi.mock('@/components/LetterTiles', () => ({
  LetterTiles: ({ length }: { length: number }) => <div>blanks:{length}</div>,
}));

import PlayPage from './page';

const me = { id: 'me-1', displayName: 'Evan' };
const turn = (id: string, word: string): TurnDTO => ({
  id,
  gameId: 'g1',
  drawerId: 'friend-1',
  guesserId: 'me-1',
  word,
  strokes: [],
  status: 'awaiting_guess',
  pointsAwarded: 0,
});

describe('PlayPage deep link (NOTIF-04)', () => {
  beforeEach(() => {
    replace.mockReset();
    fetchAuthSession.mockReset();
    fetchPending.mockReset();
    fetchAuthSession.mockResolvedValue({
      me,
      friends: [{ opponent: { id: 'friend-1', displayName: 'Chris' }, gameId: 'g1' }],
    });
    // Two pending turns with distinguishable letter counts.
    fetchPending.mockResolvedValue([turn('t-cat', 'cat'), turn('t-elephant', 'elephant')]);
  });

  it('auto-opens the turn named in ?turn=', async () => {
    window.history.replaceState({}, '', '/play?turn=t-elephant');
    render(<PlayPage />);
    // The 8-letter deep-linked turn is active (not the 3-letter one, not the list).
    await waitFor(() => expect(screen.getByText('blanks:8')).toBeInTheDocument());
    expect(screen.getByTestId('replay')).toBeInTheDocument();
  });

  it('shows the pending list (no active turn) when there is no ?turn=', async () => {
    window.history.replaceState({}, '', '/play');
    render(<PlayPage />);
    await waitFor(() =>
      expect(screen.getByText(/drawing\(s\)\s+waiting/i)).toBeInTheDocument(),
    );
    expect(screen.queryByTestId('replay')).not.toBeInTheDocument();
  });

  it('falls back to the list when ?turn= is not a pending turn', async () => {
    window.history.replaceState({}, '', '/play?turn=does-not-exist');
    render(<PlayPage />);
    await waitFor(() => expect(fetchPending).toHaveBeenCalled());
    expect(screen.queryByTestId('replay')).not.toBeInTheDocument();
  });
});
