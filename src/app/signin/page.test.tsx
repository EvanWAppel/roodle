import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SignInPage from './page';
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe('phone sign in', () => {
  it('uses the email keyboard and recovers from a failed connection', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const user = userEvent.setup();
    render(<SignInPage />);
    expect(screen.getByRole('textbox')).toHaveAttribute('inputmode', 'email');
    await user.type(screen.getByRole('textbox'), 'qa@example.com');
    await user.click(screen.getByRole('button', { name: 'Send magic link' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/try again/i);
    expect(
      screen.getByRole('button', { name: 'Send magic link' }),
    ).toBeEnabled();
  });
});
