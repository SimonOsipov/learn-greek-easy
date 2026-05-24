/**
 * ExercisesView Component Tests (ADMIN2-11 / EXERR-02 / ADMIN2-HEAD)
 *
 * Note: PageHead (H1, breadcrumb, kicker) is now owned by AdminPage.
 * ExercisesView renders stat cards + SegControl + AdminExercisesSection.
 * Updated in EXR-74/EXR-00b to reflect new i18n keys and component name.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ExercisesView from '../ExercisesView';

vi.mock('@/components/admin/exercises/AdminExercisesSection', () => ({
  AdminExercisesSection: (props: { modality: string }) => (
    <div data-testid="admin-exercises-section" data-modality={props.modality} />
  ),
}));

describe('ExercisesView', () => {
  it('renders without throwing', () => {
    expect(() => render(<ExercisesView />)).not.toThrow();
  });

  it('renders all four StatCard titles', () => {
    render(<ExercisesView />);
    expect(screen.getByText('Total exercises')).toBeTruthy();
    expect(screen.getByText('Approved')).toBeTruthy();
    expect(screen.getByText('Awaiting review')).toBeTruthy();
    expect(screen.getByText('With audio')).toBeTruthy();
  });

  it('renders "—" for all four StatCard n values', () => {
    render(<ExercisesView />);
    expect(screen.getAllByText('—')).toHaveLength(4);
  });

  it('renders both modality options and defaults to "listening"', () => {
    render(<ExercisesView />);
    expect(screen.getByRole('button', { name: /Listening/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Reading/i })).toBeTruthy();
    expect(screen.getByTestId('admin-exercises-section').getAttribute('data-modality')).toBe(
      'listening'
    );
  });

  it('clicking "Reading" flips the sentinel to data-modality="reading"', async () => {
    const user = userEvent.setup();
    render(<ExercisesView />);

    await user.click(screen.getByRole('button', { name: /Reading/i }));

    expect(screen.getByTestId('admin-exercises-section').getAttribute('data-modality')).toBe(
      'reading'
    );
  });
});
