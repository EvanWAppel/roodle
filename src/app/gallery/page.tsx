import Link from 'next/link';
import { redirect } from 'next/navigation';
import { GameShell } from '@/components/GameShell';
import { GalleryTile, type GalleryTileData } from '@/components/GalleryTile';
import { getDb } from '@/db/client';
import { getCurrentUser } from '@/auth/currentUser';
import { listFriendsWithGames, isGameMember } from '@/db/friends';
import { getGameGallery, type GalleryEntry } from '@/db/gallery';

// The gallery reflects resolved turns as they land, so read fresh each request.
export const dynamic = 'force-dynamic';

interface GameGallery {
  opponentName: string;
  gameId: string;
  entries: GalleryTileData[];
}

/**
 * Keep only the serializable fields the client tile needs. Notably drops
 * `resolvedAt` (a Date), so nothing non-serializable crosses to the client.
 */
function toTileData(e: GalleryEntry): GalleryTileData {
  return {
    turnId: e.turnId,
    word: e.word,
    drawing: e.drawing,
    drawerName: e.drawerName,
    status: e.status,
    pointsAwarded: e.pointsAwarded,
  };
}

function GallerySection({ gallery }: { gallery: GameGallery }) {
  return (
    <section className="score-section" aria-label={`Drawings with ${gallery.opponentName}`}>
      <div className="section-heading">
        <h2>with {gallery.opponentName}</h2>
        <span>
          {gallery.entries.length}{' '}
          {gallery.entries.length === 1 ? 'drawing' : 'drawings'}
        </span>
      </div>
      {gallery.entries.length === 0 ? (
        <p className="gallery-empty">No finished drawings yet.</p>
      ) : (
        <div className="gallery-grid">
          {gallery.entries.map((e) => (
            <GalleryTile key={e.turnId} entry={e} />
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * DESIGN-10: a private per-game gallery of completed drawings. Shows every game
 * the signed-in user is in; an optional `?game=<id>` deep-link focuses one game
 * but only after an explicit membership check (guards against viewing a game you
 * aren't part of). Only resolved turns are shown, so no unrevealed answer leaks.
 */
export default async function GalleryPage({
  searchParams,
}: {
  searchParams: Promise<{ game?: string | string[] }>;
}) {
  const me = await getCurrentUser();
  if (!me) redirect('/signin');

  const db = await getDb();
  const params = await searchParams;
  const gameParam = typeof params.game === 'string' ? params.game : undefined;

  const friends = await listFriendsWithGames(db, me.id);

  // Deep-link to a single game — authorize membership before serving it.
  if (gameParam) {
    if (!(await isGameMember(db, me.id, gameParam))) redirect('/gallery');
    const friend = friends.find((f) => f.gameId === gameParam);
    const entries = (await getGameGallery(db, gameParam)).map(toTileData);
    return (
      <GameShell
        title="Your shared sketchbook."
        eyebrow="The gallery"
        current="/gallery"
      >
        <GallerySection
          gallery={{
            opponentName: friend?.opponent.displayName ?? 'your friend',
            gameId: gameParam,
            entries,
          }}
        />
      </GameShell>
    );
  }

  const galleries: GameGallery[] = await Promise.all(
    friends.map(async (f) => ({
      opponentName: f.opponent.displayName,
      gameId: f.gameId,
      entries: (await getGameGallery(db, f.gameId)).map(toTileData),
    })),
  );

  const hasAnyDrawing = galleries.some((g) => g.entries.length > 0);

  return (
    <GameShell
      title="Your shared sketchbook."
      eyebrow="The gallery"
      current="/gallery"
    >
      {galleries.length === 0 ? (
        <div className="empty-panel">
          <span className="empty-mark" aria-hidden="true">
            🖼️
          </span>
          <h2>No drawings yet.</h2>
          <p>Every finished round lands here — words, drawings, and all.</p>
          <Link href="/friends" className="button">
            Invite a friend
          </Link>
        </div>
      ) : !hasAnyDrawing ? (
        <div className="empty-panel">
          <span className="empty-mark" aria-hidden="true">
            🖼️
          </span>
          <h2>No finished drawings yet.</h2>
          <p>Draw and guess a round, and your sketchbook starts filling up.</p>
          <Link href="/draw" className="button">
            Draw something
          </Link>
        </div>
      ) : (
        galleries.map((g) => <GallerySection key={g.gameId} gallery={g} />)
      )}
    </GameShell>
  );
}
