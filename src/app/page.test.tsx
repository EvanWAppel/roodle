import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Home is an async server component that reads the session; stub it as signed-out.
vi.mock('@/auth/currentUser', () => ({
  getCurrentUser: vi.fn(async () => null),
}));
// Pretend email is configured so the sign-in link renders.
vi.mock('@/auth/email', () => ({ emailConfigured: () => true }));

import Home from './page';

describe('Home route', () => {
  it('renders the heading and a sign-in link when signed out', async () => {
    render(await Home());
    expect(screen.getByRole('heading', { name: /roodle/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument();
  });
});
