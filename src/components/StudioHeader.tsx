import Link from 'next/link';

/**
 * Header for the public/studio shell (home, sample round). `current` marks the
 * active nav item for assistive tech; a skip link jumps past the nav to the
 * page's `#main-content` (which both pages that use this header provide).
 */
export function StudioHeader({ current }: { current?: string }) {
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="studio-header">
        <Link href="/" className="wordmark" aria-label="Roodle home">
          roodle<span aria-hidden="true">.</span>
        </Link>
        <nav aria-label="Main navigation" className="studio-nav">
          <Link href="/" aria-current={current === '/' ? 'page' : undefined}>
            Your games
          </Link>
          <Link
            href="/scores"
            aria-current={current === '/scores' ? 'page' : undefined}
          >
            Scores
          </Link>
          <Link
            href="/friends"
            className="button button-small"
            aria-current={current === '/friends' ? 'page' : undefined}
          >
            Invite a friend <span aria-hidden="true">↗</span>
          </Link>
        </nav>
      </header>
    </>
  );
}
