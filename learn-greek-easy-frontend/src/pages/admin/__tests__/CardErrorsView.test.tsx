/**
 * CardErrorsView Component Tests (ADMIN2-11 / EXERR-03 / ADMIN2-HEAD)
 *
 * Note: PageHead (H1, breadcrumb, kicker) is now owned by AdminPage.
 * CardErrorsView renders stat cards + AdminCardErrorSection.
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

  it('renders all four StatCard titles', () => {
    render(<CardErrorsView />);
    // Updated in CER-52: CardErrorsView now uses cardErrors.stats.* keys
    expect(screen.getByText('Total reports')).toBeTruthy();
    expect(screen.getByText('Awaiting review')).toBeTruthy();
    expect(screen.getByText('Fixed')).toBeTruthy();
    expect(screen.getByText('Median time to fix')).toBeTruthy();
  });

  it('renders "—" for all four StatCard n values', () => {
    render(<CardErrorsView />);
    expect(screen.getAllByText('—')).toHaveLength(4);
  });

  it('mounts AdminCardErrorSection sentinel', () => {
    render(<CardErrorsView />);
    expect(screen.getByTestId('admin-card-error-section')).toBeTruthy();
  });
});
