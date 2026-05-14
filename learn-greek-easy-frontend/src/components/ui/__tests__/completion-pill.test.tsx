import React from 'react';

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { CompletionPill } from '../completion-pill';

describe('CompletionPill', () => {
  it('renders label and value', () => {
    render(<CompletionPill label="EN" value="2/2" done />);
    expect(screen.getByText(/EN/)).toBeInTheDocument();
    expect(screen.getByText(/2\/2/)).toBeInTheDocument();
  });

  it('applies .is-done when done=true', () => {
    const { container } = render(<CompletionPill label="Pron" value="✓" done />);
    expect(container.firstChild).toHaveClass('is-done');
    expect(container.firstChild).not.toHaveClass('is-todo');
  });

  it('applies .is-todo when done=false', () => {
    const { container } = render(<CompletionPill label="Audio" value="—" done={false} />);
    expect(container.firstChild).toHaveClass('is-todo');
    expect(container.firstChild).not.toHaveClass('is-done');
  });

  it('does NOT parse value — done is the only source of truth', () => {
    // Pass value="✓" but done=false. Pill should render as is-todo regardless.
    const { container } = render(<CompletionPill label="X" value="✓" done={false} />);
    expect(container.firstChild).toHaveClass('is-todo');
  });
});
