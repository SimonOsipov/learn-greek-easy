/**
 * ExercisesView Component Tests
 *
 * StatCards have moved into AdminExercisesStats (inside AdminExercisesSection).
 * This file tests the page-level chrome: action buttons, SegControl, and section mount.
 * AdminExercisesSection is mocked — stat tiles are tested in AdminExercisesStats.test.tsx.
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

vi.mock('@/services/adminAPI', () => ({
  adminAPI: {
    generateExerciseBatch: vi.fn().mockResolvedValue({ scheduled: 0, exercise_ids: [] }),
  },
}));

describe('ExercisesView', () => {
  it('renders without throwing', () => {
    expect(() => render(<ExercisesView />)).not.toThrow();
  });

  it('renders the Generate batch and New exercise action buttons', () => {
    render(<ExercisesView />);
    expect(screen.getByRole('button', { name: /generate batch/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /new exercise/i })).toBeTruthy();
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
