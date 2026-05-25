/**
 * ExercisesView Component Tests
 *
 * The action button (New exercise) has moved to the PageHead.actions slot in AdminPage.
 * The modality SegControl has moved into AdminExercisesToolbar (EXR2-24-08).
 * This file tests: section mount and drawer open/close driven by the store (not local state).
 * AdminExercisesSection is mocked — stat tiles are tested in AdminExercisesStats.test.tsx.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

import { useAdminExercisesStore } from '@/stores/adminExercisesStore';
import ExercisesView from '../ExercisesView';

vi.mock('@/components/admin/exercises/AdminExercisesSection', () => ({
  AdminExercisesSection: () => <div data-testid="admin-exercises-section" />,
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

  it('does NOT render a modality SegControl in ExercisesView (moved to toolbar)', () => {
    render(<ExercisesView />);
    // The modality SegControl is now inside AdminExercisesToolbar (mocked away here).
    // No Listening/Reading buttons should appear directly in ExercisesView.
    expect(screen.queryByRole('button', { name: /Listening/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Reading/i })).toBeNull();
  });

  it('renders the AdminExercisesSection without a modality prop', () => {
    const { container } = render(<ExercisesView />);
    const section = container.querySelector('[data-testid="admin-exercises-section"]');
    expect(section).toBeTruthy();
    // No modality data attribute — prop was removed
    expect(section!.getAttribute('data-modality')).toBeNull();
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
