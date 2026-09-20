import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Home from './page';

describe('Home route', () => {
  it('renders the Roodle heading', () => {
    render(<Home />);
    expect(screen.getByRole('heading', { name: /roodle/i })).toBeInTheDocument();
  });
});
