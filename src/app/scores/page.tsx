import Link from 'next/link';
import { GameShell } from '@/components/GameShell';
import { redirect } from 'next/navigation';
import { getDb } from '@/db/client';
import { getCurrentUser } from '@/auth/currentUser';
import { listFriendsWithGames } from '@/db/friends';
import {
  getGameScoreboard,
  getPlayerStats,
  getGameHistory,
  type PlayerStats,
  type ScoreRow,
  type HistoryRow,
} from '@/db/stats';

// Always read fresh at request time (scores change as turns resolve).
export const dynamic = 'force-dynamic';

function StatCard({ name, stats }: { name: string; stats: PlayerStats }) {
  return (
    <div className="stat-panel">
      <h3>{name}</h3>
      <dl>
        <dt>Points</dt>
        <dd>{stats.points}</dd>
        <dt>Correct guesses</dt>
        <dd>{stats.correctGuesses}</dd>
        <dt>Current streak</dt>
        <dd>{stats.currentStreak}</dd>
        <dt>Longest streak</dt>
        <dd>{stats.longestStreak}</dd>
        <dt>Games</dt>
        <dd>{stats.gamesPlayed}</dd>
      </dl>
    </div>
  );
}

export default async function ScoresPage() {
  const me = await getCurrentUser();
  if (!me) redirect('/signin');

  const db = await getDb();
  const friends = await listFriendsWithGames(db, me.id);
  const myStats = await getPlayerStats(db, me.id);

  // Per-game scoreboard + history across all the user's games.
  const games = await Promise.all(
    friends.map(async (f) => ({
      opponent: f.opponent,
      board: await getGameScoreboard(db, f.gameId),
      history: await getGameHistory(db, f.gameId),
    })),
  );

  return (
    <GameShell
      title="A little friendly rivalry."
      eyebrow="Your shared story"
      current="/scores"
    >
      <section>
        <p className="eyebrow">Your stats</p>
        <StatCard name={me.displayName} stats={myStats} />
      </section>

      {friends.length === 0 && (
        <div className="empty-panel">
          <span className="empty-mark" aria-hidden="true">
            🏆
          </span>
          <h2>No games yet.</h2>
          <p>Your shared story starts with a first round.</p>
          <Link href="/friends" className="button">
            Invite a friend
          </Link>
        </div>
      )}

      {games.map(({ opponent, board, history }) => (
        <section key={opponent.id} className="score-section">
          <p className="eyebrow">vs {opponent.displayName}</p>
          <ol className="score-list">
            {board.map((row: ScoreRow, i) => (
              <li key={row.playerId} className="history-row">
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
          <ul className="history-list">
            {history.length === 0 && (
              <li className="history-empty">No rounds finished yet.</li>
            )}
            {history.map((h: HistoryRow) => (
              <li key={h.turnId} className="history-row">
                <span>
                  <strong>{h.guesserName}</strong>{' '}
                  {h.status === 'guessed' ? 'guessed' : 'gave up on'}{' '}
                  <span className="history-word">&ldquo;{h.word}&rdquo;</span>
                </span>
                <span>
                  {h.status === 'guessed' ? `+${h.pointsAwarded} 🎉` : '—'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </GameShell>
  );
}
