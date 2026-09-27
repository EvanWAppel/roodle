import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FriendsPage from './page';

// Real useRouter returns a stable reference; mirror that so effects don't loop.
const router = { push: vi.fn() };
vi.mock('next/navigation', () => ({ useRouter: () => router }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Route fetch by URL + method so the mount-time GET and later POSTs coexist. */
function stubFetch(handlers: {
  get?: () => Response;
  post?: (body: unknown) => Response;
}) {
  const post = vi.fn((_url: string, init?: RequestInit) =>
    Promise.resolve(
      handlers.post?.(init?.body ? JSON.parse(init.body as string) : null) ??
        new Response('{}', { status: 201 }),
    ),
  );
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    if (method === 'GET') {
      return Promise.resolve(
        handlers.get?.() ?? new Response('{"invites":[]}', { status: 200 }),
      );
    }
    return post(url, init);
  });
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, post };
}

const invitesResponse = (invites: unknown[]) =>
  new Response(JSON.stringify({ invites }), { status: 200 });

describe('friend invitations', () => {
  it('offers an explicit resend after a duplicate and sends the resend flag', async () => {
    const post = vi
      .fn()
      .mockReturnValueOnce(new Response('{}', { status: 409 }))
      .mockReturnValueOnce(new Response('{}', { status: 201 }));
    stubFetch({ post });
    const user = userEvent.setup();
    render(<FriendsPage />);
    await user.type(screen.getByLabelText(/friend’s email/i), 'friend@example.com');
    await user.click(screen.getByRole('button', { name: 'Send invite' }));
    await user.click(
      await screen.findByRole('button', { name: 'Resend invite' }),
    );
    expect(post).toHaveBeenLastCalledWith({
      email: 'friend@example.com',
      resend: true,
    });
    expect(await screen.findByText(/Invite sent!/)).toBeInTheDocument();
  });

  it('allows retrying after a network failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => {
        if ((init?.method ?? 'GET') === 'GET') {
          return Promise.resolve(invitesResponse([]));
        }
        return Promise.reject(new Error('offline'));
      }),
    );
    const user = userEvent.setup();
    render(<FriendsPage />);
    await user.type(screen.getByLabelText(/friend’s email/i), 'friend@example.com');
    await user.click(screen.getByRole('button', { name: 'Send invite' }));
    expect(
      await screen.findByText('Could not connect. Please try again.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send invite' })).toBeEnabled();
  });

  it('lists the user’s pending invitations with expiry labels', async () => {
    stubFetch({
      get: () =>
        invitesResponse([
          {
            id: '1',
            inviteeEmail: 'pending@example.com',
            expired: false,
            label: 'Expires in 5 days',
          },
          {
            id: '2',
            inviteeEmail: 'stale@example.com',
            expired: true,
            label: 'Expired',
          },
        ]),
    });
    render(<FriendsPage />);
    expect(await screen.findByText('pending@example.com')).toBeInTheDocument();
    expect(screen.getByText('Expires in 5 days')).toBeInTheDocument();
    expect(screen.getByText('stale@example.com')).toBeInTheDocument();
    expect(screen.getByText('Expired')).toBeInTheDocument();
  });

  it('resends a pending invite from the list and refreshes it', async () => {
    let getCall = 0;
    const post = vi.fn(() => new Response('{}', { status: 201 }));
    const { fetchMock } = stubFetch({
      get: () => {
        getCall += 1;
        return invitesResponse([
          {
            id: '1',
            inviteeEmail: 'pending@example.com',
            expired: false,
            label: getCall === 1 ? 'Expires in 2 days' : 'Expires in 7 days',
          },
        ]);
      },
      post,
    });
    const user = userEvent.setup();
    render(<FriendsPage />);
    await user.click(await screen.findByRole('button', { name: 'Resend' }));
    expect(post).toHaveBeenCalledWith({
      email: 'pending@example.com',
      resend: true,
    });
    // The list is refetched, so the fresh expiry label appears.
    expect(await screen.findByText('Expires in 7 days')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(3); // mount GET, POST, refetch GET
  });

  it('surfaces a delivery error when a resend fails', async () => {
    stubFetch({
      get: () =>
        invitesResponse([
          {
            id: '1',
            inviteeEmail: 'pending@example.com',
            expired: false,
            label: 'Expires in 2 days',
          },
        ]),
      post: () =>
        new Response(
          JSON.stringify({
            error: 'The invite email could not be sent. Please try again.',
          }),
          { status: 502 },
        ),
    });
    const user = userEvent.setup();
    render(<FriendsPage />);
    await user.click(await screen.findByRole('button', { name: 'Resend' }));
    expect(
      await screen.findByText(/could not be sent/i),
    ).toBeInTheDocument();
  });
});
