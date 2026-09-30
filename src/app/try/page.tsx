'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { StudioHeader } from '@/components/StudioHeader';
import { DrawingReplay } from '@/components/DrawingReplay';
import { LetterTiles } from '@/components/LetterTiles';
import { buildTileTray, guessMatches } from '@/lib/guess';
import { SAMPLE_DRAWING, SAMPLE_WORD } from '@/lib/sampleRound';

/**
 * DESIGN-11: an optional sample round for signed-out visitors. It runs the real
 * draw→replay→guess loop entirely client-side against a labeled fixture. It makes
 * NO network calls — no sign-in, no private game reads/writes, no email — so no
 * real user is ever touched or implied.
 */
export default function TryPage() {
  const tiles = useMemo(() => buildTileTray(SAMPLE_WORD), []);
  const length = SAMPLE_WORD.replace(/\s+/g, '').length;
  const [solved, setSolved] = useState(false);
  const [wrong, setWrong] = useState(false);

  function onComplete(guess: string) {
    if (guessMatches(SAMPLE_WORD, guess)) {
      setWrong(false);
      setSolved(true);
    } else {
      setWrong(true);
    }
  }

  return (
    <div className="studio-shell">
      <StudioHeader current="/try" />
      <main id="main-content" className="studio-main">
        <section className="studio-intro">
          <p className="eyebrow">Sample round · no sign-in needed</p>
          <h1>
            Give it a go.
            <br />
            <em>Guess the drawing.</em>
          </h1>
          <p>
            This is a demo with a made-up drawing — nothing here is a real game or
            a real person. Watch it appear, then tap letters to spell what it is.
          </p>
        </section>

        <section className="guess-workspace" aria-label="Sample round">
          <div className="replay-panel">
            <p className="eyebrow">Sample drawing</p>
            <DrawingReplay drawing={SAMPLE_DRAWING} label="Sample drawing" />
          </div>

          {solved ? (
            <div className="form-panel success-panel" role="status">
              <p className="success-title">
                Nice — it was “{SAMPLE_WORD}”! That’s the whole game.
              </p>
              <p className="field-hint">
                Real rounds are drawings from your friends, one guess at a time.
                No timers, no ads.
              </p>
              <Link className="button" href="/signin">
                Sign in to play for real <span aria-hidden="true">↗</span>
              </Link>
              <button
                type="button"
                className="text-link"
                onClick={() => {
                  setSolved(false);
                  setWrong(false);
                }}
              >
                Try the sample again
              </button>
            </div>
          ) : (
            <LetterTiles
              tiles={tiles}
              length={length}
              onComplete={onComplete}
              wrong={wrong}
              onChange={() => setWrong(false)}
            />
          )}
        </section>
      </main>
      <footer className="studio-footer">
        <span>Made for friends. Free of distractions.</span>
        <span>No ads. No coins. Just a good time.</span>
      </footer>
    </div>
  );
}
