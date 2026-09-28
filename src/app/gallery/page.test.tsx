// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { User } from '@/db/schema';

// Controllable session, db, and data-access so we can assert the auth *ordering*
// (redirect a non-member BEFORE any gallery data is fetched) without a real DB.
const currentUser = vi.fn<() => Promise<User | null>>();
vi.mock('@/auth/currentUser', () => ({ getCurrentUser: () => currentUser() }));

vi.mock('@/db/client', () => ({ getDb: () => Promise.resolve({}) }));

const isGameMember = vi.fn();
const listFriendsWithGames = vi.fn();
vi.mock('@/db/friends', () => ({
  isGameMember: (...a: unknown[]) => isGameMember(...a),
  listFriendsWithGames: (...a: unknown[]) => listFriendsWithGames(...a),
}));

const getGameGallery = vi.fn();
vi.mock('@/db/gallery', () => ({
  getGameGallery: (...a: unknown[]) => getGameGallery(...a),
}));

// redirect() throws to halt rendering, like the real Next implementation.
const redirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});
vi.mock('next/navigation', () => ({ redirect: (url: string) => redirect(url) }));

import GalleryPage from './page';

const me = { id: 'me', displayName: 'Me' } as User;

describe('GalleryPage authorization (DESIGN-10)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser.mockResolvedValue(me);
    listFriendsWithGames.mockResolvedValue([]);
    getGameGallery.mockResolvedValue([]);
  });

  it('redirects an unauthenticated visitor to /signin before touching data', async () => {
    currentUser.mockResolvedValue(null);
    await expect(
      GalleryPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow('REDIRECT:/signin');
    expect(listFriendsWithGames).not.toHaveBeenCalled();
    expect(getGameGallery).not.toHaveBeenCalled();
  });

  it('redirects a non-member deep-link BEFORE fetching that game’s gallery', async () => {
    isGameMember.mockResolvedValue(false);
    await expect(
      GalleryPage({ searchParams: Promise.resolve({ game: 'someone-elses' }) }),
    ).rejects.toThrow('REDIRECT:/gallery');
    expect(isGameMember).toHaveBeenCalledWith({}, 'me', 'someone-elses');
    // The load-bearing guarantee: no gallery data is read for a non-member.
    expect(getGameGallery).not.toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith('/gallery');
  });

  it('fetches only the requested game for an authorized member', async () => {
    isGameMember.mockResolvedValue(true);
    listFriendsWithGames.mockResolvedValue([
      { opponent: { id: 'f', displayName: 'Friend' }, gameId: 'g1' },
    ]);
    await GalleryPage({ searchParams: Promise.resolve({ game: 'g1' }) });
    expect(getGameGallery).toHaveBeenCalledWith({}, 'g1');
    expect(redirect).not.toHaveBeenCalled();
  });

  it('ignores an array-form ?game= and shows the own-games view', async () => {
    await GalleryPage({
      searchParams: Promise.resolve({ game: ['a', 'b'] }),
    });
    // Falls through to the session-derived own-games path; never treats the
    // array as a single game id, so isGameMember isn't consulted.
    expect(isGameMember).not.toHaveBeenCalled();
    expect(listFriendsWithGames).toHaveBeenCalledWith({}, 'me');
  });
});
