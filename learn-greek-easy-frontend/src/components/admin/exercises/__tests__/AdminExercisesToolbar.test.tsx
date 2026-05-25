/**
 * AdminExercisesToolbar Component Tests — EXR2-24-06 / EXR2-24-07
 *
 * Covers:
 * 1. news-seg-l span is absent (no label prop passed to SegControl)
 * 2. Each SegControl group retains role="group" + aria-label via ariaLabel prop
 * 3. All four groups' options render (at least one option per group visible)
 * 4. Two-row layout: row-1 = search + Source + Type; row-2 = Level + Status
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

// ── EXR2-24-07: Two-row layout ─────────────────────────────────────────────────

describe('AdminExercisesToolbar — two-row layout', () => {
  it('renders two distinct row containers', () => {
    const { container } = render(<AdminExercisesToolbar modality="listening" />);
    const row1 = container.querySelector('[data-testid="exercises-toolbar-row-1"]');
    const row2 = container.querySelector('[data-testid="exercises-toolbar-row-2"]');
    expect(row1).toBeTruthy();
    expect(row2).toBeTruthy();
  });

  it('row 1 contains the search input', () => {
    const { container } = render(<AdminExercisesToolbar modality="listening" />);
    const row1 = container.querySelector('[data-testid="exercises-toolbar-row-1"]');
    expect(row1!.querySelector('[data-testid="admin-exercises-search"]')).toBeTruthy();
  });

  it('row 1 contains Source and Type SegControl groups', () => {
    const { container } = render(<AdminExercisesToolbar modality="listening" />);
    const row1 = container.querySelector('[data-testid="exercises-toolbar-row-1"]')!;
    // getByRole scoped to row1 element
    const groups = Array.from(row1.querySelectorAll('[role="group"]')).map((el) =>
      el.getAttribute('aria-label')
    );
    expect(groups).toContain('exercises.filters.source.label');
    expect(groups).toContain('exercises.filters.type.label');
    // Level and Status must NOT be in row 1
    expect(groups).not.toContain('exercises.filters.level.label');
    expect(groups).not.toContain('exercises.filters.status.label');
  });

  it('row 2 contains Level and Status SegControl groups', () => {
    const { container } = render(<AdminExercisesToolbar modality="listening" />);
    const row2 = container.querySelector('[data-testid="exercises-toolbar-row-2"]')!;
    const groups = Array.from(row2.querySelectorAll('[role="group"]')).map((el) =>
      el.getAttribute('aria-label')
    );
    expect(groups).toContain('exercises.filters.level.label');
    expect(groups).toContain('exercises.filters.status.label');
    // Source and Type must NOT be in row 2
    expect(groups).not.toContain('exercises.filters.source.label');
    expect(groups).not.toContain('exercises.filters.type.label');
  });
});
