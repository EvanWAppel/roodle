'use client';

/** SLICE-03 dev-only identity switch. Removed when AUTH lands real sessions. */
export type DevPlayer = 'evan' | 'christine';

export function PlayerSwitch({
  value,
  onChange,
}: {
  value: DevPlayer;
  onChange: (p: DevPlayer) => void;
}) {
  const players: DevPlayer[] = ['evan', 'christine'];
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-gray-500">Play as:</span>
      {players.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          className={`rounded border px-2 py-1 capitalize ${
            value === p ? 'bg-black text-white' : 'bg-white'
          }`}
        >
          {p}
        </button>
      ))}
    </div>
  );
}
