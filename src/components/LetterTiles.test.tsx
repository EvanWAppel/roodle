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
