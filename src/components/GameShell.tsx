import Link from 'next/link';
import type { ReactNode } from 'react';

const destinations = [
  { href: '/', label: 'Games', path: 'M3 10 12 3l9 7v11h-6v-7H9v7H3Z' },
  {
    href: '/draw',
    label: 'Draw',
    path: 'm15 4 5 5M4 16 16 4a2 2 0 0 1 4 4L8 20l-5 1Z',
  },
  { href: '/play', label: 'Guess', path: 'M4 4h16v12H9l-5 4ZM9 8h6M9 12h3' },
  {
    href: '/packs',
    label: 'Packs',
    path: 'm3 7 9-4 9 4-9 4ZM3 12l9 4 9-4M3 17l9 4 9-4',
  },
  {
    href: '/scores',
    label: 'Scores',
    path: 'M5 20v-6h4v6M10 20V4h4v16M15 20V9h4v11',
  },
];

export function GameShell({
  title,
  eyebrow,
  current,
  children,
}: {
  title: string;
  eyebrow?: string;
  current: string;
  children: ReactNode;
}) {
  return (
    <div className="game-shell">
      <a className="skip-link" href="#game-content">
        Skip to game
      </a>
      <header className="game-header">
        <Link href="/" className="wordmark" aria-label="Roodle home">
          roodle<span aria-hidden="true">.</span>
        </Link>
        <Link
          className="invite-link"
          href="/friends"
          aria-current={current === '/friends' ? 'page' : undefined}
        >
          Invite a friend <span aria-hidden="true">↗</span>
        </Link>
      </header>
      <nav className="game-nav" aria-label="Game navigation">
        {destinations.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current === item.href ? 'page' : undefined}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d={item.path} />
            </svg>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
      <main id="game-content" className="game-content">
        <div className="game-heading">
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h1>{title}</h1>
        </div>
        {children}
      </main>
    </div>
  );
}
