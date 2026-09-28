import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TryPage from './page';
import { SAMPLE_WORD } from '@/lib/sampleRound';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Tap tray tiles to spell the word, robust to the shuffled tray + any decoys. */
async function spell(user: ReturnType<typeof userEvent.setup>, word: string) {
  const tray = screen.getByRole('group', { name: 'tiles' });
  for (const ch of word.toUpperCase()) {
    const tile = within(tray)
      .getAllByRole('button', { name: ch })
      .find((b) => !(b as HTMLButtonElement).disabled);
    if (!tile) throw new Error(`no enabled tile for "${ch}"`);
    await user.click(tile);
  }
}

describe('TryPage (DESIGN-11 sample round)', () => {
  it('renders the sample drawing and a clearly-labeled demo', () => {
    render(<TryPage />);
    expect(screen.getByText(/sample round/i)).toBeInTheDocument();
    // The replay canvas is present (the sample drawing).
    expect(
      screen.getByRole('button', { name: /jump to final/i }),
    ).toBeInTheDocument();
  });

  it('solves with a correct guess, entirely client-side', async () => {
    const user = userEvent.setup();
    render(<TryPage />);
    await spell(user, SAMPLE_WORD);
    expect(
      await screen.findByText(new RegExp(`it was .${SAMPLE_WORD}`, 'i')),
    ).toBeInTheDocument();
    // Offers a real sign-in next step.
    expect(
      screen.getByRole('link', { name: /sign in to play for real/i }),
    ).toBeInTheDocument();
  });

  it('recovers from a wrong guess without solving', async () => {
    const user = userEvent.setup();
    render(<TryPage />);
    const tray = screen.getByRole('group', { name: 'tiles' });
    // Force a non-matching first letter (SAMPLE_WORD starts with 'H'), so the
    // assembled guess can never be the answer regardless of tray shuffle.
    const notFirst = SAMPLE_WORD[0].toUpperCase() === 'O' ? 'U' : 'O';
    await user.click(within(tray).getAllByRole('button', { name: notFirst })[0]);
    for (let i = 1; i < SAMPLE_WORD.length; i++) {
      const t = within(tray)
        .getAllByRole('button')
        .find((b) => !(b as HTMLButtonElement).disabled)!;
      await user.click(t);
    }
    expect(screen.getByRole('group', { name: 'answer' })).toHaveAttribute(
      'data-wrong',
      'true',
    );
    expect(
      screen.queryByText(new RegExp(`it was .${SAMPLE_WORD}`, 'i')),
    ).toBeNull();
  });

  it('makes NO network calls — no private data, game writes, or email', async () => {
    // Set up the interaction driver before stubbing globals so it's unaffected.
    const user = userEvent.setup();
    const fetchSpy = vi.fn();
    const sendBeacon = vi.fn();
    const xhrOpen = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal(
      'XMLHttpRequest',
      class {
        open = xhrOpen;
        send = vi.fn();
        setRequestHeader = vi.fn();
      },
    );
    Object.defineProperty(navigator, 'sendBeacon', {
      value: sendBeacon,
      configurable: true,
    });

    render(<TryPage />);
    await spell(user, SAMPLE_WORD);
    await screen.findByText(new RegExp(`it was .${SAMPLE_WORD}`, 'i'));
    // No exfiltration by any channel — fully client-side against a fixture.
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(sendBeacon).not.toHaveBeenCalled();
    expect(xhrOpen).not.toHaveBeenCalled();

    delete (navigator as { sendBeacon?: unknown }).sendBeacon;
  });
});
