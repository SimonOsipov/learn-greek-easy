/**
 * CollocationsSection Component Tests
 *
 * DX-10 (R6): placeholder grid + exactly one danger UnwiredDot + Greek lang="el".
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CollocationsSection } from '../CollocationsSection';

// Mock UnwiredDot
vi.mock('@/features/decks/dx', () => ({
  UnwiredDot: ({ tone, 'aria-label': ariaLabel }: { tone?: string; 'aria-label'?: string }) => (
    <span data-testid="unwired-dot" data-tone={tone} aria-label={ariaLabel} />
  ),
}));

describe('CollocationsSection', () => {
  it('renders .dx-section container', () => {
    render(<CollocationsSection lemma="σπίτι" />);
    expect(screen.getByTestId('collocations-section')).toHaveClass('dx-section');
  });

  it('renders exactly one danger UnwiredDot (R6)', () => {
    render(<CollocationsSection lemma="σπίτι" />);
    const dots = screen.getAllByTestId('unwired-dot');
    // There should be exactly one dot in the heading
    expect(dots).toHaveLength(1);
    expect(dots[0]).toHaveAttribute('data-tone', 'danger');
  });

  it('danger dot has a meaningful aria-label', () => {
    render(<CollocationsSection lemma="σπίτι" />);
    const dot = screen.getByTestId('unwired-dot');
    const label = dot.getAttribute('aria-label') ?? '';
    expect(label.length).toBeGreaterThan(0);
    expect(label).not.toBe('Placeholder — not yet connected to backend data.');
  });

  it('renders the collocations grid', () => {
    render(<CollocationsSection lemma="σπίτι" />);
    expect(screen.getByTestId('collocations-grid')).toBeInTheDocument();
  });

  it('renders collocation rows', () => {
    render(<CollocationsSection lemma="σπίτι" />);
    const rows = screen.getAllByTestId('collocation-row');
    expect(rows.length).toBeGreaterThan(0);
  });

  it('Greek slots have lang="el"', () => {
    render(<CollocationsSection lemma="σπίτι" />);
    const greekSlots = screen
      .getAllByRole('generic')
      .filter((el) => el.getAttribute('lang') === 'el');
    expect(greekSlots.length).toBeGreaterThan(0);
  });
});
