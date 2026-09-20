import Link from 'next/link';
import { getDb } from '@/db/client';
import { ensureSeed } from '@/db/seed';
import {
  getGameScoreboard,
  getPlayerStats,
  getGameHistory,
  type PlayerStats,
} from '@/db/stats';

// Always read fresh at request time (scores change as turns resolve).
export const dynamic = 'force-dynamic';

function StatCard({ name, stats }: { name: string; stats: PlayerStats }) {
  return (
    <div className="rounded-lg border p-4">
      <h3 className="mb-2 text-lg font-semibold">{name}</h3>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <dt className="text-gray-500">Points</dt>
        <dd className="text-right font-medium">{stats.points}</dd>
        <dt className="text-gray-500">Correct guesses</dt>
        <dd className="text-right font-medium">{stats.correctGuesses}</dd>
        <dt className="text-gray-500">Current streak</dt>
        <dd className="text-right font-medium">{stats.currentStreak}</dd>
        <dt className="text-gray-500">Longest streak</dt>
        <dd className="text-right font-medium">{stats.longestStreak}</dd>
        <dt className="text-gray-500">Games</dt>
        <dd className="text-right font-medium">{stats.gamesPlayed}</dd>
      </dl>
    </div>
  );
}

export default async function ScoresPage() {
  const db = await getDb();
  const { playerA, playerB, game } = await ensureSeed(db);
  const [board, statsA, statsB, history] = await Promise.all([
    getGameScoreboard(db, game.id),
    getPlayerStats(db, playerA.id),
    getPlayerStats(db, playerB.id),
    getGameHistory(db, game.id),
  ]);

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Scores</h1>
        <nav className="flex gap-4 text-sm">
          <Link href="/draw" className="text-blue-600 underline">
            Draw
          </Link>
          <Link href="/play" className="text-blue-600 underline">
            Guess
          </Link>
        </nav>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Scoreboard
        </h2>
        <ol className="flex flex-col gap-1">
          {board.map((row, i) => (
            <li
              key={row.playerId}
              className="flex items-center justify-between rounded border px-3 py-2"
            >
              <span>
                {i === 0 && board.length > 1 && row.points > 0 ? '👑 ' : ''}
                {row.displayName}
              </span>
              <span className="font-semibold">
                {row.points} pt{row.points === 1 ? '' : 's'}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <StatCard name={playerA.displayName} stats={statsA} />
        <StatCard name={playerB.displayName} stats={statsB} />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Recent rounds
        </h2>
        <ul className="flex flex-col gap-1 text-sm">
          {history.length === 0 && (
            <li className="text-gray-400">No rounds finished yet.</li>
          )}
          {history.map((h) => (
            <li
              key={h.turnId}
              className="flex items-center justify-between rounded border px-3 py-2"
            >
              <span>
                <strong>{h.guesserName}</strong>{' '}
                {h.status === 'guessed' ? 'guessed' : 'gave up on'}{' '}
                <span className="font-mono">&ldquo;{h.word}&rdquo;</span>
              </span>
              <span>
                {h.status === 'guessed' ? `+${h.pointsAwarded} 🎉` : '—'}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
