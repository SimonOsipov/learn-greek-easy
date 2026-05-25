/**
 * AdminExercisesToolbar Component Tests — EXR2-24-06
 *
 * Covers:
 * 1. news-seg-l span is absent (no label prop passed to SegControl)
 * 2. Each SegControl group retains role="group" + aria-label via ariaLabel prop
 * 3. All four groups' options render (at least one option per group visible)
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { AdminExercisesToolbar } from '../AdminExercisesToolbar';

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string) => k,
  }),
}));

vi.mock('@/lib/analytics/track', () => ({
  track: vi.fn(),
}));

vi.mock('@/stores/adminExercisesStore', () => ({
  useAdminExercisesStore: (selector: (s: ReturnType<typeof makeStoreState>) => unknown) =>
    selector(makeStoreState()),
}));

function makeStoreState() {
  return {
    source: 'all' as const,
    type: 'all' as const,
    level: 'all' as const,
    status: 'all' as const,
    q: '',
    setSource: vi.fn(),
    setType: vi.fn(),
    setLevel: vi.fn(),
    setStatus: vi.fn(),
    setQ: vi.fn(),
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('AdminExercisesToolbar — no group labels rendered', () => {
  it('does not render any news-seg-l span', () => {
    const { container } = render(<AdminExercisesToolbar modality="listening" />);
    const labels = container.querySelectorAll('.news-seg-l');
    expect(labels).toHaveLength(0);
  });
});

describe('AdminExercisesToolbar — ARIA group affordance', () => {
  it('renders role="group" for Source filter with correct aria-label', () => {
    render(<AdminExercisesToolbar modality="listening" />);
    expect(screen.getByRole('group', { name: 'exercises.filters.source.label' })).toBeTruthy();
  });

  it('renders role="group" for Type filter with correct aria-label', () => {
    render(<AdminExercisesToolbar modality="listening" />);
    expect(screen.getByRole('group', { name: 'exercises.filters.type.label' })).toBeTruthy();
  });

  it('renders role="group" for Level filter with correct aria-label', () => {
    render(<AdminExercisesToolbar modality="listening" />);
    expect(screen.getByRole('group', { name: 'exercises.filters.level.label' })).toBeTruthy();
  });

  it('renders role="group" for Status filter with correct aria-label', () => {
    render(<AdminExercisesToolbar modality="listening" />);
    expect(screen.getByRole('group', { name: 'exercises.filters.status.label' })).toBeTruthy();
  });
});

describe('AdminExercisesToolbar — filter options render', () => {
  it('renders Source "all" option', () => {
    render(<AdminExercisesToolbar modality="listening" />);
    expect(screen.getByText('exercises.filters.source.all')).toBeTruthy();
  });

  it('renders Type "all" option', () => {
    render(<AdminExercisesToolbar modality="listening" />);
    expect(screen.getByText('exercises.filters.type.all')).toBeTruthy();
  });

  it('renders Level "all" option', () => {
    render(<AdminExercisesToolbar modality="listening" />);
    expect(screen.getByText('exercises.filters.level.all')).toBeTruthy();
  });

  it('renders Status "all" option', () => {
    render(<AdminExercisesToolbar modality="listening" />);
    expect(screen.getByText('exercises.filters.status.all')).toBeTruthy();
  });
});
