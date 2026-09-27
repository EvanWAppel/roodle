import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FriendsPage from './page';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('friend invitations', () => {
  it('offers an explicit resend after a duplicate and sends the resend flag', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 409 }))
      .mockResolvedValueOnce(new Response('{}', { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<FriendsPage />);
    await user.type(screen.getByRole('textbox'), 'friend@example.com');
    await user.click(screen.getByRole('button', { name: 'Send invite' }));
    await user.click(
      await screen.findByRole('button', { name: 'Resend invite' }),
    );
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      email: 'friend@example.com',
      resend: true,
    });
    expect(await screen.findByText(/Invite sent!/)).toBeInTheDocument();
  });

  it('allows retrying after a network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const user = userEvent.setup();
    render(<FriendsPage />);
    await user.type(screen.getByRole('textbox'), 'friend@example.com');
    await user.click(screen.getByRole('button', { name: 'Send invite' }));
    expect(
      await screen.findByText('Could not connect. Please try again.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send invite' })).toBeEnabled();
  });
});
