/**
 * ExercisesView Component Tests
 *
 * The action button (New exercise) has moved to the PageHead.actions slot in AdminPage.
 * This file tests the page-level chrome that remains in ExercisesView: SegControl,
 * section mount, and drawer open/close driven by the store (not local state).
 * AdminExercisesSection is mocked — stat tiles are tested in AdminExercisesStats.test.tsx.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

import { useAdminExercisesStore } from '@/stores/adminExercisesStore';
import ExercisesView from '../ExercisesView';

vi.mock('@/components/admin/exercises/AdminExercisesSection', () => ({
  AdminExercisesSection: (props: { modality: string }) => (
    <div data-testid="admin-exercises-section" data-modality={props.modality} />
  ),
}));

// Reset store drawer state before each test
beforeEach(() => {
  useAdminExercisesStore.getState().closeDrawer();
});

describe('ExercisesView', () => {
  it('renders without throwing', () => {
    expect(() => render(<ExercisesView />)).not.toThrow();
  });

  it('does NOT render a local va-page-actions-only action bar', () => {
    const { container } = render(<ExercisesView />);
    expect(container.querySelector('.va-page-actions-only')).toBeNull();
  });

  it('renders both modality options and defaults to "listening"', () => {
    render(<ExercisesView />);
    expect(screen.getByRole('button', { name: /Listening/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Reading/i })).toBeTruthy();
    expect(screen.getByTestId('admin-exercises-section').getAttribute('data-modality')).toBe(
      'listening'
    );
  });

  it('SidePanel is closed when store mode is null', () => {
    render(<ExercisesView />);
    // SidePanel should not be open — its content should not be visible
    expect(screen.queryByText('Drawer body coming soon.')).toBeNull();
  });

  it('SidePanel opens when store openCompose() is called', () => {
    render(<ExercisesView />);
    // Trigger open via store action
    useAdminExercisesStore.getState().openCompose();
    // Re-render is synchronous for Zustand in tests
    render(<ExercisesView />);
    expect(screen.getAllByText('Drawer body coming soon.').length).toBeGreaterThan(0);
  });

  it('closeDrawer resets mode to null (store layer)', () => {
    useAdminExercisesStore.getState().openCompose();
    expect(useAdminExercisesStore.getState().mode).toBe('compose');
    useAdminExercisesStore.getState().closeDrawer();
    expect(useAdminExercisesStore.getState().mode).toBeNull();
  });
});
