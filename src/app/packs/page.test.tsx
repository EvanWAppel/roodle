import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
}));

import PacksPage from './page';

const SESSION = {
  me: { id: 'me', displayName: 'Me' },
  friends: [
    { opponent: { id: 'friend', displayName: 'Friend' }, gameId: 'game-1' },
  ],
};

const PACKS = [
  { id: 'p1', name: 'Animals', isBuiltin: true, enabled: false },
  { id: 'p2', name: 'Food', isBuiltin: true, enabled: true },
];

describe('PacksPage (WORD-06)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/auth/session') {
        return new Response(JSON.stringify(SESSION));
      }
      if (url.startsWith('/api/packs?gameId=')) {
        return new Response(JSON.stringify(PACKS));
      }
      if (url === '/api/packs' && init?.method === 'POST') {
        return new Response(JSON.stringify({ id: 'new' }), { status: 201 });
      }
      if (url === '/api/packs/enable') {
        return new Response(JSON.stringify({ ok: true }));
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    // Unmount first so no pending effect fires a fetch after the stub is gone.
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('lists packs with their enabled state for the game', async () => {
    render(<PacksPage />);
    await waitFor(() => {
      expect(screen.getByLabelText('Animals')).toBeInTheDocument();
    });
    expect(screen.getByLabelText('Animals')).not.toBeChecked();
    expect(screen.getByLabelText('Food')).toBeChecked();
  });

  it('creating a pack posts the words to /api/packs', async () => {
    const user = userEvent.setup();
    render(<PacksPage />);
    await waitFor(() => {
      expect(screen.getByLabelText('Animals')).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText('Pack name'), 'Inside Jokes');
    await user.type(screen.getByLabelText('Words'), 'noodle, roodle');
    await user.click(screen.getByRole('button', { name: /create pack/i }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (c) => c[0] === '/api/packs' && c[1]?.method === 'POST',
      );
      expect(call).toBeDefined();
      const body = JSON.parse(call![1].body as string);
      expect(body.name).toBe('Inside Jokes');
      expect(body.words).toEqual(['noodle', 'roodle']);
    });
  });

  it('toggling a pack posts to /api/packs/enable', async () => {
    const user = userEvent.setup();
    render(<PacksPage />);
    await waitFor(() => {
      expect(screen.getByLabelText('Animals')).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText('Animals'));
    await waitFor(() => {
      const call = fetchMock.mock.calls.find((c) => c[0] === '/api/packs/enable');
      expect(call).toBeDefined();
      const body = JSON.parse(call![1].body as string);
      expect(body).toMatchObject({ gameId: 'game-1', packId: 'p1', enabled: true });
    });
  });
});
