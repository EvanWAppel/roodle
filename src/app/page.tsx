import Link from 'next/link';
import { getCurrentUser } from '@/auth/currentUser';
import { emailConfigured } from '@/auth/email';
import { getDb } from '@/db/client';
import { listGameCards } from '@/db/hub';
import { StudioHeader } from '@/components/StudioHeader';
import { GameHub } from '@/components/GameHub';

export default async function Home() {
  const user = await getCurrentUser();
  const cards = user ? await listGameCards(await getDb(), user.id) : [];
  return (
    <div className="studio-shell">
      <StudioHeader current="/" />
      <main id="main-content" className="studio-main">
        <section className="studio-intro">
          <div className="eyebrow">
            A little imagination. A little connection.
          </div>
          <h1>
            {user ? (
              <>
                Good company.
                <br />
                <em>Questionable drawings.</em>
              </>
            ) : (
              <>
                A little less scrolling.
                <br />
                <em>A little more doodling.</em>
              </>
            )}
          </h1>
          <p>
            {user
              ? 'Pick up where you left off. There’s no timer here, just friends and a blank page.'
              : 'Roodle is a private, invite-only drawing & guessing game for friends. Send a sketch, watch it unfold, make someone’s day — no ads, no purchases, no timers.'}
          </p>
          {!user && (
            <div className="intro-actions">
              {emailConfigured() && (
                <Link className="button" href="/signin">
                  Sign in <span aria-hidden="true">↗</span>
                </Link>
              )}
              <Link className="text-link" href="/try">
                Try a sample round <span aria-hidden="true">↗</span>
              </Link>
            </div>
          )}
        </section>
        {user ? (
          <GameHub cards={cards} />
        ) : (
          <section className="how-it-works" aria-label="How Roodle works">
            {[
              [
                '01',
                'Draw a little.',
                'A word, a few colors, and your own interpretation.',
              ],
              [
                '02',
                'Pass it along.',
                'Your friend watches the drawing come to life.',
              ],
              [
                '03',
                'Have a guess.',
                'Put the letters together. Then return the favor.',
              ],
            ].map(([n, title, copy]) => (
              <article key={n}>
                <span className="eyebrow">{n}</span>
                <h2>{title}</h2>
                <p>{copy}</p>
              </article>
            ))}
          </section>
        )}
      </main>
      <footer className="studio-footer">
        <span>Made for friends. Free of distractions.</span>
        <span>
          {user ? (
            <>
              {user.displayName} ·{' '}
              <form action="/api/auth/logout" method="post">
                <button type="submit">Sign out</button>
              </form>
            </>
          ) : (
            'No ads. No coins. Just a good time.'
          )}
        </span>
      </footer>
    </div>
  );
}
