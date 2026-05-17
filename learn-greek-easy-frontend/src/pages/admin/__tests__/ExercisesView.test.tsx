/**
 * ExercisesView Component Tests (ADMIN2-11 / EXERR-02)
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ExercisesView from '../ExercisesView';

vi.mock('@/components/admin/exercises/AdminExerciseList', () => ({
  AdminExerciseList: (props: { modality: string }) => (
    <div data-testid="admin-exercise-list" data-modality={props.modality} />
  ),
}));

describe('ExercisesView', () => {
  it('renders without throwing', () => {
    expect(() => render(<ExercisesView />)).not.toThrow();
  });

  it('renders the H1 with text "Exercises"', () => {
    render(<ExercisesView />);
    expect(screen.getByRole('heading', { level: 1, name: /Exercises/i })).toBeTruthy();
  });

  it('renders all four StatCard titles', () => {
    render(<ExercisesView />);
    expect(screen.getByText('Total exercises')).toBeTruthy();
    expect(screen.getByText('Approved')).toBeTruthy();
    expect(screen.getByText('Pending review')).toBeTruthy();
    expect(screen.getByText('By source')).toBeTruthy();
  });

  it('renders "—" for all four StatCard n values', () => {
    render(<ExercisesView />);
    expect(screen.getAllByText('—')).toHaveLength(4);
  });

  it('renders both modality options and defaults to "listening"', () => {
    render(<ExercisesView />);
    expect(screen.getByRole('button', { name: /Listening/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Reading/i })).toBeTruthy();
    expect(screen.getByTestId('admin-exercise-list').getAttribute('data-modality')).toBe(
      'listening'
    );
  });

  it('clicking "Reading" flips the sentinel to data-modality="reading"', async () => {
    const user = userEvent.setup();
    render(<ExercisesView />);

    await user.click(screen.getByRole('button', { name: /Reading/i }));

    expect(screen.getByTestId('admin-exercise-list').getAttribute('data-modality')).toBe('reading');
  });
});
