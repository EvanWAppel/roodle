import Link from 'next/link';

export function StudioHeader() {
  return (
    <header className="studio-header">
      <Link href="/" className="wordmark" aria-label="Roodle home">
        roodle<span aria-hidden="true">.</span>
      </Link>
      <nav aria-label="Main navigation" className="studio-nav">
        <Link href="/">Your games</Link>
        <Link href="/scores">Scores</Link>
        <Link href="/friends" className="button button-small">
          Invite a friend <span aria-hidden="true">↗</span>
        </Link>
      </nav>
    </header>
  );
}
