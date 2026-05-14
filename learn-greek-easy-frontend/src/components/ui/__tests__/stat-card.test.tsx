import React from 'react';

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Layers } from 'lucide-react';

import { StatCard } from '../stat-card';

describe('StatCard', () => {
  it('renders title, sub, n, and icon', () => {
    render(<StatCard title="Decks" sub="12 active" n={12} icon={<Layers />} tone="blue" />);
    expect(screen.getByText('Decks')).toBeInTheDocument();
    expect(screen.getByText('12 active')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('applies tone class', () => {
    const { container } = render(<StatCard title="x" n={1} icon={<Layers />} tone="amber" />);
    expect(container.firstChild).toHaveClass('tone-amber');
  });

  it('renders no sparkline when bars is empty/undefined', () => {
    const { container } = render(<StatCard title="x" n={1} icon={<Layers />} tone="blue" />);
    expect(container.querySelector('.stat-bars')).toBeNull();
  });

  it('renders one <span> per bars value', () => {
    const { container } = render(
      <StatCard title="x" n={1} icon={<Layers />} tone="blue" bars={[1, 2, 3, 4, 5]} />
    );
    expect(container.querySelectorAll('.stat-bars span').length).toBe(5);
  });

  it('is not clickable when onClick is omitted', () => {
    const { container } = render(<StatCard title="x" n={1} icon={<Layers />} tone="blue" />);
    expect(container.firstChild).not.toHaveClass('is-clickable');
    expect(container.firstChild).not.toHaveAttribute('role', 'button');
  });

  it('becomes role=button when onClick is provided', () => {
    const onClick = vi.fn();
    const { container } = render(
      <StatCard title="x" n={1} icon={<Layers />} tone="blue" onClick={onClick} />
    );
    expect(container.firstChild).toHaveClass('is-clickable');
    expect(container.firstChild).toHaveAttribute('role', 'button');
    expect(container.firstChild).toHaveAttribute('tabindex', '0');
  });

  it('Enter key fires onClick', () => {
    const onClick = vi.fn();
    const { container } = render(
      <StatCard title="x" n={1} icon={<Layers />} tone="blue" onClick={onClick} />
    );
    fireEvent.keyDown(container.firstChild as HTMLElement, { key: 'Enter' });
    expect(onClick).toHaveBeenCalled();
  });

  it('Space key fires onClick', () => {
    const onClick = vi.fn();
    const { container } = render(
      <StatCard title="x" n={1} icon={<Layers />} tone="blue" onClick={onClick} />
    );
    fireEvent.keyDown(container.firstChild as HTMLElement, { key: ' ' });
    expect(onClick).toHaveBeenCalled();
  });
});
