import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PackManager } from './PackManager';
import type { NewPackWord } from '@/lib/api';

type CreateFn = (input: {
  name: string;
  words: NewPackWord[];
}) => Promise<{ ok: true; packId: string }>;

describe('PackManager (WORD-06)', () => {
  it('posts the parsed words with the pack name on submit', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn<CreateFn>().mockResolvedValue({ ok: true, packId: 'p1' });
    render(<PackManager onCreate={onCreate} />);

    await user.type(screen.getByLabelText('Pack name'), 'My Pack');
    await user.type(screen.getByLabelText('Words'), 'cat\ndog\nplatypus:hard');
    await user.click(screen.getByRole('button', { name: /create pack/i }));

    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate).toHaveBeenCalledWith({
      name: 'My Pack',
      words: [
        { text: 'cat', difficulty: 'medium' },
        { text: 'dog', difficulty: 'medium' },
        { text: 'platypus', difficulty: 'hard' },
      ],
    });
  });

  it('applies the selected default difficulty to lines without one', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn<CreateFn>().mockResolvedValue({ ok: true, packId: 'p2' });
    render(<PackManager onCreate={onCreate} />);

    await user.type(screen.getByLabelText('Pack name'), 'Hard Pack');
    await user.selectOptions(screen.getByLabelText('Default difficulty'), 'hard');
    await user.type(screen.getByLabelText('Words'), 'volcano\nant:easy');
    await user.click(screen.getByRole('button', { name: /create pack/i }));

    expect(onCreate).toHaveBeenCalledWith({
      name: 'Hard Pack',
      words: [
        { text: 'volcano', difficulty: 'hard' },
        { text: 'ant', difficulty: 'easy' },
      ],
    });
  });

  it('does not post when there are no words', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn<CreateFn>();
    render(<PackManager onCreate={onCreate} />);

    await user.type(screen.getByLabelText('Pack name'), 'Empty');
    await user.click(screen.getByRole('button', { name: /create pack/i }));

    expect(onCreate).not.toHaveBeenCalled();
    expect(screen.getByText(/add at least one word/i)).toBeInTheDocument();
  });

  it('does not post without a name', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn<CreateFn>();
    render(<PackManager onCreate={onCreate} />);

    await user.type(screen.getByLabelText('Words'), 'cat');
    await user.click(screen.getByRole('button', { name: /create pack/i }));

    expect(onCreate).not.toHaveBeenCalled();
    expect(screen.getByText(/name your pack/i)).toBeInTheDocument();
  });
});
