import Link from 'next/link';
import { getCurrentUser } from '@/auth/currentUser';

export default async function Home() {
  const user = await getCurrentUser();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-4xl font-bold">Roodle</h1>
      <p className="text-lg text-gray-500">
        Draw &amp; guess with friends. No ads, no coins, no nonsense.
      </p>
      <div className="text-sm text-gray-500">
        {user ? (
          <span>
            Signed in as <strong>{user.displayName}</strong> ·{' '}
            <form action="/api/auth/logout" method="post" className="inline">
              <button type="submit" className="text-blue-600 underline">
                sign out
              </button>
            </form>
          </span>
        ) : (
          <Link href="/signin" className="text-blue-600 underline">
            Sign in
          </Link>
        )}
      </div>
      <div className="flex gap-4">
        <Link
          href="/draw"
          className="rounded bg-blue-600 px-5 py-2 text-white"
        >
          Draw
        </Link>
        <Link href="/play" className="rounded border px-5 py-2">
          Guess
        </Link>
      </div>
      <Link href="/scores" className="text-sm text-blue-600 underline">
        View scores &amp; stats
      </Link>
    </main>
  );
}
