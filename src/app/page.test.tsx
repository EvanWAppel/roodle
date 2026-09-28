import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
const { getCurrentUser, getDb, listGameCards } = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getDb: vi.fn(),
  listGameCards: vi.fn(),
}));
vi.mock('@/auth/currentUser', () => ({ getCurrentUser }));
vi.mock('@/auth/email', () => ({ emailConfigured: () => true }));
vi.mock('@/db/client', () => ({ getDb }));
vi.mock('@/db/hub', () => ({ listGameCards }));
import Home from './page';
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  getCurrentUser.mockResolvedValue(null);
});
describe('Home route', () => {
  it('explains the game and offers sign-in without querying private games', async () => {
    render(await Home());
    expect(
      screen.getByRole('heading', { level: 1, name: /more doodling/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument();
    // Offers the no-sign-in sample round (DESIGN-11).
    expect(
      screen.getByRole('link', { name: /try a sample round/i }),
    ).toHaveAttribute('href', '/try');
    expect(getDb).not.toHaveBeenCalled();
    expect(listGameCards).not.toHaveBeenCalled();
  });
  it('loads game cards for the signed-in user and renders a private hub', async () => {
    getCurrentUser.mockResolvedValue({ id: 'me', displayName: 'Evan' });
    const db = {};
    getDb.mockResolvedValue(db);
    listGameCards.mockResolvedValue([
      {
        gameId: 'g1',
        name: 'Christine',
        incoming: 1,
        waiting: 0,
        turnId: 't1',
      },
    ]);
    render(await Home());
    expect(listGameCards).toHaveBeenCalledWith(db, 'me');
    expect(
      screen.getByRole('link', { name: /Guess Christine/ }),
    ).toHaveAttribute('href', '/play?turn=t1');
    expect(
      screen.getByRole('button', { name: 'Sign out' }),
    ).toBeInTheDocument();
  });
});
