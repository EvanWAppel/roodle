import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Drawing } from '@/lib/strokes';

const router = { replace: vi.fn() };
vi.mock('next/navigation', () => ({ useRouter: () => router }));
const { fetchAuthSession, submitTurn } = vi.hoisted(() => ({
  fetchAuthSession: vi.fn(),
  submitTurn: vi.fn(),
}));
vi.mock('@/lib/api', () => ({ fetchAuthSession, submitTurn }));
const strokes: Drawing = [
  { color: '#000000', width: 2, points: [{ x: 1, y: 1 }] },
];
vi.mock('@/components/DrawCanvas', () => ({
  DrawCanvas: ({ onChange }: { onChange: (drawing: Drawing) => void }) => (
    <button onClick={() => onChange(strokes)}>Make drawing</button>
  ),
}));
import DrawPage from './page';

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState({}, '', '/draw');
  fetchAuthSession.mockResolvedValue({
    me: { id: 'me', displayName: 'Evan' },
    friends: [
      {
        opponent: { id: 'tester', displayName: 'Tester' },
        gameId: 'test-game',
      },
      {
        opponent: { id: 'christine', displayName: 'Christine' },
        gameId: 'christine-game',
      },
    ],
  });
  submitTurn.mockResolvedValue({});
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ word: { text: 'cat' } })),
      ),
  );
  // Return a fresh response on each word request.
  vi.mocked(fetch).mockImplementation(
    async () => new Response(JSON.stringify({ word: { text: 'cat' } })),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('concurrent friend games', () => {
  it('keeps inviting available and sends drawings to separate games', async () => {
    const user = userEvent.setup();
    render(<DrawPage />);
    await screen.findByText('cat');
    expect(
      screen.getByRole('link', { name: 'Invite a friend' }),
    ).toHaveAttribute('href', '/friends');
    await user.click(screen.getByRole('button', { name: 'Make drawing' }));
    await user.click(screen.getByRole('button', { name: 'Submit drawing' }));
    await waitFor(() => expect(screen.getByRole('combobox')).toBeEnabled());
    await user.selectOptions(screen.getByRole('combobox'), '1');
    await screen.findByText('cat');
    expect(
      screen.getByRole('button', { name: 'Submit drawing' }),
    ).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Make drawing' }));
    await user.click(screen.getByRole('button', { name: 'Submit drawing' }));
    expect(submitTurn).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ gameId: 'test-game', guesserId: 'tester' }),
    );
    expect(submitTurn).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        gameId: 'christine-game',
        guesserId: 'christine',
      }),
    );
  });

  it('opens the friend named in a hub game link', async () => {
    window.history.replaceState({}, '', '/draw?game=christine-game');
    render(<DrawPage />);
    await screen.findByText('cat');
    expect(screen.getByRole('combobox')).toHaveValue('1');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Make drawing' }));
    await user.click(screen.getByRole('button', { name: 'Submit drawing' }));
    expect(submitTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        gameId: 'christine-game',
        guesserId: 'christine',
      }),
    );
  });

  it('does not carry an unfinished drawing over to another opponent', async () => {
    const user = userEvent.setup();
    render(<DrawPage />);
    await screen.findByText('cat');
    await user.click(screen.getByRole('button', { name: 'Make drawing' }));
    expect(
      screen.getByRole('button', { name: 'Submit drawing' }),
    ).toBeEnabled();
    await user.selectOptions(screen.getByRole('combobox'), '1');
    await screen.findByText('cat');
    expect(
      screen.getByRole('button', { name: 'Submit drawing' }),
    ).toBeDisabled();
    expect(submitTurn).not.toHaveBeenCalled();
  });
});
