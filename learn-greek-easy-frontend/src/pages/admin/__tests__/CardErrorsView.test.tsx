/**
 * CardErrorsView Component Tests (ADMIN2-11 / EXERR-03)
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import CardErrorsView from '../CardErrorsView';

vi.mock('@/components/admin/AdminCardErrorSection', () => ({
  AdminCardErrorSection: () => <div data-testid="admin-card-error-section" />,
}));

describe('CardErrorsView', () => {
  it('renders without throwing', () => {
    expect(() => render(<CardErrorsView />)).not.toThrow();
  });

  it('renders the H1 with text "Card errors"', () => {
    render(<CardErrorsView />);
    expect(screen.getByRole('heading', { level: 1, name: /Card errors/i })).toBeTruthy();
  });

  it('renders all four StatCard titles', () => {
    render(<CardErrorsView />);
    expect(screen.getByText('Total errors')).toBeTruthy();
    expect(screen.getByText('Open')).toBeTruthy();
    expect(screen.getByText('Resolved')).toBeTruthy();
    expect(screen.getByText('Avg time to resolve')).toBeTruthy();
  });

  it('renders "—" for all four StatCard n values', () => {
    render(<CardErrorsView />);
    expect(screen.getAllByText('—')).toHaveLength(4);
  });

  it('mounts AdminCardErrorSection sentinel', () => {
    render(<CardErrorsView />);
    expect(screen.getByTestId('admin-card-error-section')).toBeTruthy();
  });

  it('renders aria-labelledby landmark and sr-only h2', () => {
    const { container } = render(<CardErrorsView />);
    expect(
      container.querySelector('section[aria-labelledby="card-errors-heading"]')
    ).not.toBeNull();
    expect(container.querySelector('h2#card-errors-heading.sr-only')).not.toBeNull();
  });
});
