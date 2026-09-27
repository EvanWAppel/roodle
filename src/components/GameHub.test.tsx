import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { GameHub } from './GameHub';
afterEach(cleanup);
it('links each friend to their own pending turn or drawing game', () => {
  render(
    <GameHub
      cards={[
        {
          name: 'Christine',
          gameId: 'christine-game',
          incoming: 1,
          waiting: 0,
          turnId: 'christine-turn',
        },
        {
          name: 'Tester',
          gameId: 'tester-game',
          incoming: 0,
          waiting: 1,
          turnId: null,
        },
      ]}
    />,
  );
  expect(screen.getByRole('link', { name: /Guess Christine/ })).toHaveAttribute(
    'href',
    '/play?turn=christine-turn',
  );
  expect(screen.getByRole('link', { name: 'Draw for Tester' })).toHaveAttribute(
    'href',
    '/draw?game=tester-game',
  );
  expect(screen.getByRole('link', { name: /Invite someone/ })).toHaveAttribute(
    'href',
    '/friends',
  );
});
it('shows an invitation path when there are no games', () => {
  render(<GameHub cards={[]} />);
  expect(screen.getByText('0 ongoing games')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Invite someone/ })).toHaveAttribute(
    'href',
    '/friends',
  );
});
