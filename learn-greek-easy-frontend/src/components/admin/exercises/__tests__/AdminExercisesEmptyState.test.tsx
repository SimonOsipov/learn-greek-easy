/**
 * AdminExercisesEmptyState unit tests (TBR2-25-08)
 *
 * Covers:
 * - Both heading branches: hasActiveFilters=true vs false
 * - "Clear filters" CTA calls useAdminExercisesStore.getState().resetFilters()
 * - data-testid="admin-exercises-empty" is present
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { AdminExercisesEmptyState } from '../AdminExercisesEmptyState';
import { useAdminExercisesStore } from '@/stores/adminExercisesStore';

beforeEach(() => {
  // Reset store to clean defaults before each test
  useAdminExercisesStore.getState().resetFilters();
});

describe('AdminExercisesEmptyState — data-testid', () => {
  it('renders the admin-exercises-empty testid', () => {
    render(<AdminExercisesEmptyState modality="listening" hasActiveFilters={false} />);
    expect(screen.getByTestId('admin-exercises-empty')).toBeTruthy();
  });
});

describe('AdminExercisesEmptyState — heading branches', () => {
  it('shows first-run heading when hasActiveFilters=false', () => {
    render(<AdminExercisesEmptyState modality="listening" hasActiveFilters={false} />);
    expect(screen.getByText('No exercises yet')).toBeTruthy();
    expect(screen.queryByText('No exercises match your filters')).toBeNull();
  });

  it('shows filter heading when hasActiveFilters=true', () => {
    render(<AdminExercisesEmptyState modality="listening" hasActiveFilters={true} />);
    expect(screen.getByText('No exercises match your filters')).toBeTruthy();
    expect(screen.queryByText('No exercises yet')).toBeNull();
  });
});

describe('AdminExercisesEmptyState — CTA', () => {
  it('does not render Clear filters button when hasActiveFilters=false', () => {
    render(<AdminExercisesEmptyState modality="listening" hasActiveFilters={false} />);
    expect(screen.queryByText('Clear filters')).toBeNull();
  });

  it('renders Clear filters button when hasActiveFilters=true', () => {
    render(<AdminExercisesEmptyState modality="listening" hasActiveFilters={true} />);
    expect(screen.getByText('Clear filters')).toBeTruthy();
  });

  it('clicking Clear filters calls resetFilters on the store', () => {
    // Put the store into a non-default state so resetFilters has something to do
    useAdminExercisesStore.getState().setStatus('approved');
    const resetSpy = vi.spyOn(useAdminExercisesStore.getState(), 'resetFilters');

    render(<AdminExercisesEmptyState modality="listening" hasActiveFilters={true} />);
    fireEvent.click(screen.getByText('Clear filters'));

    expect(resetSpy).toHaveBeenCalledOnce();
    resetSpy.mockRestore();
  });
});
