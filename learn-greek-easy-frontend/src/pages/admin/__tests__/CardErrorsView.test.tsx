/**
 * CardErrorsView Component Tests (ADMIN2-11 / EXERR-03 / ADMIN2-HEAD / CER-02)
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

vi.mock('@/services/adminAPI', () => ({
  adminAPI: {
    listCardErrors: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, page_size: 1000 }),
  },
}));

describe('CardErrorsView', () => {
  it('renders without throwing', () => {
    expect(() => render(<CardErrorsView />)).not.toThrow();
  });

  it('renders all four StatCard titles', () => {
    render(<CardErrorsView />);
    expect(screen.getByText('Total reports')).toBeTruthy();
    expect(screen.getByText('Awaiting review')).toBeTruthy();
    expect(screen.getByText('Fixed all-time')).toBeTruthy();
    expect(screen.getByText('Median time-to-fix')).toBeTruthy();
  });

  it('renders "—" for all four StatCard n values when no data loaded', () => {
    render(<CardErrorsView />);
    // Before the async fetch resolves, allReports is [] so n renders as "—"
    expect(screen.getAllByText('—')).toHaveLength(4);
  });

  it('mounts AdminCardErrorSection sentinel', () => {
    render(<CardErrorsView />);
    expect(screen.getByTestId('admin-card-error-section')).toBeTruthy();
  });
});
