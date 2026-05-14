import React from 'react';

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { Kicker } from '../kicker';

describe('Kicker', () => {
  it('renders children', () => {
    render(<Kicker>Needs attention</Kicker>);
    expect(screen.getByText('Needs attention')).toBeInTheDocument();
  });

  it('defaults dot tone to primary when no dot prop is passed', () => {
    const { container } = render(<Kicker>x</Kicker>);
    const dot = container.querySelector('.kicker-dot');
    expect(dot).toHaveAttribute('data-tone', 'primary');
  });

  it('renders the requested dot tone', () => {
    const { container } = render(<Kicker dot="amber">Drafts</Kicker>);
    expect(container.querySelector('.kicker-dot')).toHaveAttribute('data-tone', 'amber');
  });

  it('forwards className', () => {
    const { container } = render(<Kicker className="custom">x</Kicker>);
    expect(container.firstChild).toHaveClass('kicker-atom');
    expect(container.firstChild).toHaveClass('custom');
  });
});
