import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { TurnDTO, AuthSession } from '@/lib/api';

// next/navigation's router is stubbed so redirects don't blow up under jsdom.
// The router object must be stable across renders — PlayPage's session effect
// depends on it, so a fresh object each render would loop the effect forever.
const replace = vi.fn();
const router = { replace };
vi.mock('next/navigation', () => ({
  useRouter: () => router,
}));

// Drive the whole page through the api module so no network happens.
const fetchAuthSession = vi.fn<() => Promise<AuthSession>>();
const fetchPending = vi.fn<(id: string) => Promise<TurnDTO[]>>();
const submitGuess = vi.fn<(id: string, g: string) => Promise<TurnDTO>>();
const giveUp = vi.fn<(id: string) => Promise<TurnDTO>>();
vi.mock('@/lib/api', () => ({
  fetchAuthSession: () => fetchAuthSession(),
  fetchPending: (id: string) => fetchPending(id),
  submitGuess: (id: string, g: string) => submitGuess(id, g),
  giveUp: (id: string) => giveUp(id),
}));

import PlayPage from './page';

const me = { id: 'me-1', displayName: 'Me' };

const turn: TurnDTO = {
  id: 'turn-1',
  gameId: 'game-1',
  drawerId: 'you',
  guesserId: 'me-1',
  word: 'cat',
  strokes: [],
  status: 'awaiting_guess',
  pointsAwarded: 0,
};

async function openTurn() {
  render(<PlayPage />);
  // Wait for the pending list to render, then open the turn.
  const open = await screen.findByRole('button', { name: /a drawing to guess/i });
  await userEvent.click(open);
  return open;
}

describe('PlayPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchAuthSession.mockResolvedValue({ me, friends: [] });
    fetchPending.mockResolvedValue([turn]);
  });

  it('reveals the word on give up (GUESS-04)', async () => {
    giveUp.mockResolvedValue({ ...turn, status: 'gave_up', word: 'cat' });
    // After giving up the pending list is empty.
    fetchPending.mockResolvedValueOnce([turn]).mockResolvedValue([]);

    await openTurn();
    await userEvent.click(screen.getByRole('button', { name: /give up \/ reveal/i }));

    await waitFor(() =>
      expect(screen.getByText(/the word was "cat"/i)).toBeInTheDocument(),
    );
    expect(giveUp).toHaveBeenCalledWith('turn-1');
  });

  it('surfaces wrong feedback on an incorrect guess, then clears it on edit (GUESS-03)', async () => {
    submitGuess.mockResolvedValue({ ...turn, status: 'awaiting_guess' });

    await openTurn();

    function trayTile(letter: string): HTMLButtonElement {
      return screen
        .getAllByRole('button', { name: letter })
        .find((b) => b.getAttribute('data-role') === 'tile') as HTMLButtonElement;
    }

    // buildTileTray('cat') always contains C, A, T (plus random decoys). We fill
    // three blanks to complete a guess; submitGuess is mocked to report the turn
    // still awaiting, i.e. the guess was wrong — so the group must flip to wrong.
    await userEvent.click(trayTile('C'));
    await userEvent.click(trayTile('A'));
    await userEvent.click(trayTile('T'));

    await waitFor(() => expect(submitGuess).toHaveBeenCalled());

    const group = screen.getByRole('group', { name: 'answer' });
    await waitFor(() => expect(group).toHaveAttribute('data-wrong', 'true'));
    expect(screen.getByText(/not quite/i)).toBeInTheDocument();

    // Editing (clearing a filled blank) dismisses the wrong state.
    const filledBlank = screen
      .getAllByRole('button', { name: 'T' })
      .find((b) => b.getAttribute('data-role') === 'blank') as HTMLButtonElement;
    await userEvent.click(filledBlank);
    await waitFor(() => expect(group).toHaveAttribute('data-wrong', 'false'));
  });

  it('reports a correct guess and clears the active turn (GUESS-04 happy path)', async () => {
    submitGuess.mockResolvedValue({ ...turn, status: 'guessed', pointsAwarded: 1 });
    fetchPending.mockResolvedValueOnce([turn]).mockResolvedValue([]);

    await openTurn();

    function trayTile(letter: string): HTMLButtonElement {
      return screen
        .getAllByRole('button', { name: letter })
        .find((b) => b.getAttribute('data-role') === 'tile') as HTMLButtonElement;
    }

    await userEvent.click(trayTile('C'));
    await userEvent.click(trayTile('A'));
    await userEvent.click(trayTile('T'));

    await waitFor(() =>
      expect(screen.getByText(/correct! \+1 point/i)).toBeInTheDocument(),
    );
  });
});
