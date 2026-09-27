import Link from 'next/link';
import type { GameCard } from '@/db/hub';

export function GameHub({ cards }: { cards: GameCard[] }) {
  return (
    <section aria-labelledby="games-heading">
      <div className="section-heading">
        <h2 id="games-heading">On your table</h2>
        <span>
          {cards.length} ongoing {cards.length === 1 ? 'game' : 'games'}
        </span>
      </div>
      <div className="game-grid">
        {cards.map((card, i) => (
          <article
            className={`game-card ${card.incoming ? 'game-card-ready' : ''}`}
            key={card.gameId}
          >
            <div className="card-top">
              <span className={`avatar avatar-${i % 3}`} aria-hidden="true">
                {card.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="eyebrow">
                {card.incoming
                  ? 'Ready to guess'
                  : card.waiting
                    ? 'Over to them'
                    : 'A blank canvas'}
              </span>
            </div>
            <h3>{card.name}</h3>
            <p>
              {card.incoming
                ? `${card.incoming} ${card.incoming === 1 ? 'drawing is' : 'drawings are'} waiting for your best guess.`
                : card.waiting
                  ? `${card.waiting} ${card.waiting === 1 ? 'drawing' : 'drawings'} sent. A little anticipation is part of the fun.`
                  : 'Start with a word. See where your pencil takes you.'}
            </p>
            <div className="card-actions">
              {card.turnId ? (
                <Link
                  className="button"
                  href={`/play?turn=${encodeURIComponent(card.turnId)}`}
                >
                  Guess {card.name}’s drawing <span aria-hidden="true">↗</span>
                </Link>
              ) : (
                <Link
                  className="button button-outline"
                  href={`/draw?game=${encodeURIComponent(card.gameId)}`}
                >
                  Draw for {card.name} <span aria-hidden="true">↗</span>
                </Link>
              )}
              {card.turnId && (
                <Link
                  className="text-link"
                  href={`/draw?game=${encodeURIComponent(card.gameId)}`}
                >
                  Draw something too
                </Link>
              )}
            </div>
          </article>
        ))}
        <article className="game-card invite-card">
          <span className="invite-mark" aria-hidden="true">
            +
          </span>
          <h3>Make room for a friend.</h3>
          <p>The best drawings have someone on the other end.</p>
          <Link className="text-link" href="/friends">
            Invite someone to play <span aria-hidden="true">↗</span>
          </Link>
        </article>
      </div>
    </section>
  );
}
