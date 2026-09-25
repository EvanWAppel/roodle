import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LetterTiles } from './LetterTiles';

/**
 * These tests drive the LetterTiles guessing input. Tiles are rendered as
 * buttons named by their letter; blanks are buttons whose accessible name is
 * "blank N" when empty and the filled letter once tapped. Duplicate letters
 * are tracked by tile index, not letter value, so we query tray tiles by their
 * position, not just their name.
 */
describe('LetterTiles', () => {
  function trayTile(letter: string, occurrence = 0): HTMLButtonElement {
    const matches = screen
      .getAllByRole('button', { name: letter })
      .filter((b) => b.getAttribute('data-role') === 'tile');
    return matches[occurrence] as HTMLButtonElement;
  }

  it('calls onComplete once with the assembled uppercase word when all blanks fill', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn<(guess: string) => void>();
    render(<LetterTiles tiles={['T', 'A', 'C', 'X']} length={3} onComplete={onComplete} />);

    await user.click(trayTile('C'));
    await user.click(trayTile('A'));
    await user.click(trayTile('T'));

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith('CAT');
  });

  it('does not call onComplete before every blank is filled', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn<(guess: string) => void>();
    render(<LetterTiles tiles={['T', 'A', 'C', 'X']} length={3} onComplete={onComplete} />);

    await user.click(trayTile('C'));
    await user.click(trayTile('A'));

    expect(onComplete).not.toHaveBeenCalled();
  });

  it('clears a filled blank on tap and returns its tile to the tray for reuse', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn<(guess: string) => void>();
    render(<LetterTiles tiles={['T', 'A', 'C', 'X']} length={3} onComplete={onComplete} />);

    // Fill first blank with X by mistake.
    await user.click(trayTile('X'));
    expect(trayTile('X')).toBeDisabled();

    // Tap the filled blank to clear it; the X tile returns to the tray.
    const filledBlank = screen
      .getAllByRole('button', { name: 'X' })
      .find((b) => b.getAttribute('data-role') === 'blank')!;
    await user.click(filledBlank);
    expect(trayTile('X')).not.toBeDisabled();

    // Now spell CAT correctly.
    await user.click(trayTile('C'));
    await user.click(trayTile('A'));
    await user.click(trayTile('T'));

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith('CAT');
  });

  it('flags a wrong fill against the expected word (GUESS-03)', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn<(guess: string) => void>();
    // Expected CAT; place X into the first blank — should be flagged wrong.
    render(
      <LetterTiles
        tiles={['T', 'A', 'C', 'X']}
        length={3}
        onComplete={onComplete}
        expected="CAT"
      />,
    );

    await user.click(trayTile('X'));
    // The wrong blank is flagged via data-wrong and surfaced accessibly ("(wrong)").
    const wrongBlank = screen
      .getByRole('button', { name: 'X (wrong)' });
    expect(wrongBlank).toHaveAttribute('data-role', 'blank');
    expect(wrongBlank).toHaveAttribute('data-wrong', 'true');

    // A correct placement is not flagged.
    await user.click(trayTile('A'));
    const okBlank = screen
      .getAllByRole('button', { name: 'A' })
      .find((b) => b.getAttribute('data-role') === 'blank')!;
    expect(okBlank).not.toHaveAttribute('data-wrong');
  });

  it('pre-places and locks a hinted letter (GUESS-05)', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn<(guess: string) => void>();
    // Hint: first blank is C, pre-placed and locked.
    render(
      <LetterTiles
        tiles={['T', 'A', 'C', 'X']}
        length={3}
        onComplete={onComplete}
        locked={{ 0: 'C' }}
      />,
    );

    // The C tile is consumed by the hint from the start.
    expect(trayTile('C')).toBeDisabled();

    // The first blank shows C, is locked, and can't be cleared by tapping.
    const hintBlank = screen
      .getAllByRole('button', { name: 'C' })
      .find((b) => b.getAttribute('data-role') === 'blank')!;
    expect(hintBlank).toHaveAttribute('data-locked', 'true');
    expect(hintBlank).toBeDisabled();
    await user.click(hintBlank);
    expect(trayTile('C')).toBeDisabled(); // still consumed; hint survived

    // Filling the remaining two blanks completes the word including the hint.
    await user.click(trayTile('A'));
    await user.click(trayTile('T'));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith('CAT');
  });

  it('preserves in-progress placements when a hint arrives (locked grows)', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn<(guess: string) => void>();
    // Same stable component instance; the parent grows `locked` on a hint
    // WITHOUT remounting (no key change). Word CAT.
    const { rerender } = render(
      <LetterTiles
        tiles={['C', 'A', 'T', 'X']}
        length={3}
        onComplete={onComplete}
        locked={{}}
      />,
    );

    // Player fills blank 0 with X (wrong), then blank 1 with A (left-to-right).
    await user.click(trayTile('X'));
    await user.click(trayTile('A'));
    expect(trayTile('X')).toBeDisabled();
    expect(trayTile('A')).toBeDisabled();

    // A hint now reveals the first letter (C), locked — no remount.
    rerender(
      <LetterTiles
        tiles={['C', 'A', 'T', 'X']}
        length={3}
        onComplete={onComplete}
        locked={{ 0: 'C' }}
      />,
    );

    // The hint replaces the wrong X in blank 0 (X returns to tray), the player's
    // A in blank 1 is RETAINED (the pre-fix remount would have wiped it), and C
    // is consumed by the hint.
    expect(trayTile('C')).toBeDisabled();
    expect(trayTile('A')).toBeDisabled();
    expect(trayTile('X')).not.toBeDisabled();

    // Completing the last blank (T) yields CAT — hint + preserved input + new tile.
    await user.click(trayTile('T'));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith('CAT');
  });

  it('tracks duplicate letters by tile index so both copies are consumable', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn<(guess: string) => void>();
    // "TOOT": two O's and two T's.
    render(<LetterTiles tiles={['T', 'O', 'O', 'T']} length={4} onComplete={onComplete} />);

    await user.click(trayTile('T', 0));
    await user.click(trayTile('O', 0));
    await user.click(trayTile('O', 1));
    await user.click(trayTile('T', 1));

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith('TOOT');
  });
});
