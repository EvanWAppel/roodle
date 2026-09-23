'use client';

import Link from 'next/link';
import { PackManager } from '@/components/PackManager';

/**
 * WORD-06: word-pack management. Create a custom pack here; per-game enable/
 * disable of packs lives on the draw flow (a game-scoped control), since a pack
 * is enabled or disabled for a specific game, not globally.
 */
export default function PacksPage() {
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Word packs</h1>
        <nav className="flex gap-4 text-sm">
          <Link href="/draw" className="text-blue-600 underline">
            Draw →
          </Link>
        </nav>
      </div>
      <p className="text-sm text-gray-500">
        Create a custom pack of words to draw from. Built-in packs are available
        to every game by default.
      </p>
      <PackManager />
    </main>
  );
}
