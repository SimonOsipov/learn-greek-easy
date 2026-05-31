import React from 'react';

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { XPCard } from '../XPCard';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock xpStore
const mockUseXPStore = vi.fn();
vi.mock('@/stores/xpStore', () => ({
  useXPStore: (selector: (state: Record<string, unknown>) => unknown) => mockUseXPStore(selector),
  selectXPStats: (state: Record<string, unknown>) => state.xpStats,
  selectIsLoadingStats: (state: Record<string, unknown>) => state.loadingStats,
  selectIsMaxLevel: (state: Record<string, unknown>) =>
    (state.xpStats as { current_level?: number } | null)?.current_level === 15,
}));

// Mock useStudyStreak
const mockUseStudyStreak = vi.fn();
vi.mock('@/hooks/useStudyStreak', () => ({
  useStudyStreak: () => mockUseStudyStreak(),
}));

// Mock UI primitives so we don't need full provider context
vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  ),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  ),
}));

vi.mock('@/components/ui/progress', () => ({
  Progress: ({ value, className }: { value: number; className?: string }) => (
    <div data-testid="progress-bar" data-value={value} className={className} />
  ),
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: ({ className }: { className?: string }) => (
    <div data-testid="skeleton" className={className} />
  ),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeXPStats(
  overrides: Partial<{
    total_xp: number;
    current_level: number;
    level_name_greek: string;
    level_name_english: string;
    xp_in_level: number;
    xp_for_next_level: number;
    progress_percentage: number;
  }> = {}
) {
  return {
    total_xp: 500,
    current_level: 3,
    level_name_greek: 'Αρχάριος',
    level_name_english: 'Beginner',
    xp_in_level: 50,
    xp_for_next_level: 100,
    progress_percentage: 50,
    ...overrides,
  };
}

function makeStoreState(
  overrides: {
    xpStats?: ReturnType<typeof makeXPStats> | null;
    loadingStats?: boolean;
  } = {}
) {
  return {
    xpStats: overrides.xpStats !== undefined ? overrides.xpStats : makeXPStats(),
    loadingStats: overrides.loadingStats ?? false,
    loadXPStats: vi.fn(),
  };
}

function renderXPCard(
  storeState: ReturnType<typeof makeStoreState> = makeStoreState(),
  streakData: { currentStreak: number } | null = null,
  props: Parameters<typeof XPCard>[0] = {}
) {
  mockUseXPStore.mockImplementation((selector: (state: Record<string, unknown>) => unknown) =>
    selector(storeState as unknown as Record<string, unknown>)
  );
  mockUseStudyStreak.mockReturnValue({ streak: streakData, loading: false, error: null });
  return render(<XPCard {...props} />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('XPCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // getLevelColor — tier boundary tests
  // -------------------------------------------------------------------------

  describe('getLevelColor tier boundaries', () => {
    it('level 1 uses blue color classes', () => {
      const { container } = renderXPCard(
        makeStoreState({ xpStats: makeXPStats({ current_level: 1 }) })
      );
      // The icon container uses the bg color class
      expect(container.innerHTML).toContain('bg-blue-100');
      expect(container.innerHTML).toContain('text-blue-600');
    });

    it('level 5 (top of blue tier) still uses blue color classes', () => {
      const { container } = renderXPCard(
        makeStoreState({ xpStats: makeXPStats({ current_level: 5 }) })
      );
      expect(container.innerHTML).toContain('bg-blue-100');
      expect(container.innerHTML).toContain('text-blue-600');
    });

    it('level 6 (bottom of purple tier) uses purple color classes', () => {
      const { container } = renderXPCard(
        makeStoreState({ xpStats: makeXPStats({ current_level: 6 }) })
      );
      expect(container.innerHTML).toContain('bg-purple-100');
      expect(container.innerHTML).toContain('text-purple-600');
    });

    it('level 10 (top of purple tier) uses purple color classes', () => {
      const { container } = renderXPCard(
        makeStoreState({ xpStats: makeXPStats({ current_level: 10 }) })
      );
      expect(container.innerHTML).toContain('bg-purple-100');
      expect(container.innerHTML).toContain('text-purple-600');
    });

    it('level 11 (bottom of gold tier) uses amber/gold color classes', () => {
      const { container } = renderXPCard(
        makeStoreState({ xpStats: makeXPStats({ current_level: 11 }) })
      );
      expect(container.innerHTML).toContain('bg-amber-100');
      expect(container.innerHTML).toContain('text-amber-600');
    });
  });

  // -------------------------------------------------------------------------
  // formatXP — boundary tests
  // -------------------------------------------------------------------------

  describe('formatXP boundaries', () => {
    it('formats 9999 without K suffix', () => {
      renderXPCard(makeStoreState({ xpStats: makeXPStats({ total_xp: 9999 }) }));
      // 9999 is below 10000, should be formatted with toLocaleString (no K)
      expect(screen.getByText(/9[,.]?999 XP/)).toBeInTheDocument();
    });

    it('formats 10000 with K suffix as 10.0K', () => {
      renderXPCard(makeStoreState({ xpStats: makeXPStats({ total_xp: 10000 }) }));
      expect(screen.getByText('10.0K XP')).toBeInTheDocument();
    });

    it('formats 100000 with K suffix as 100.0K', () => {
      renderXPCard(makeStoreState({ xpStats: makeXPStats({ total_xp: 100000 }) }));
      expect(screen.getByText('100.0K XP')).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Max-level trophy
  // -------------------------------------------------------------------------

  describe('max-level state', () => {
    it('shows "Max Level Achieved!" trophy text at level 15', () => {
      renderXPCard(makeStoreState({ xpStats: makeXPStats({ current_level: 15 }) }));
      expect(screen.getByText('Max Level Achieved!')).toBeInTheDocument();
    });

    it('hides progress bar at max level', () => {
      renderXPCard(makeStoreState({ xpStats: makeXPStats({ current_level: 15 }) }));
      expect(screen.queryByTestId('progress-bar')).not.toBeInTheDocument();
    });

    it('shows progress bar and "to Level N" text when not at max level', () => {
      renderXPCard(makeStoreState({ xpStats: makeXPStats({ current_level: 3 }) }));
      expect(screen.getByTestId('progress-bar')).toBeInTheDocument();
      expect(screen.queryByText('Max Level Achieved!')).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Streak section visibility
  // -------------------------------------------------------------------------

  describe('streak section visibility', () => {
    it('shows streak badge when currentStreak > 0', () => {
      renderXPCard(makeStoreState(), { currentStreak: 5 });
      expect(screen.getByLabelText('5 day streak')).toBeInTheDocument();
      expect(screen.getByLabelText('5 day streak').textContent).toContain('5');
    });

    it('hides streak badge when currentStreak is 0', () => {
      renderXPCard(makeStoreState(), { currentStreak: 0 });
      expect(screen.queryByLabelText(/day streak/)).not.toBeInTheDocument();
    });

    it('hides streak badge when streak is null', () => {
      renderXPCard(makeStoreState(), null);
      expect(screen.queryByLabelText(/day streak/)).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  describe('loading state', () => {
    it('renders skeleton when propLoading is true', () => {
      renderXPCard(makeStoreState(), null, { isLoading: true });
      expect(screen.getByTestId('skeleton')).toBeInTheDocument();
    });

    it('renders skeleton when store is loading', () => {
      renderXPCard(makeStoreState({ loadingStats: true }));
      expect(screen.getByTestId('skeleton')).toBeInTheDocument();
    });

    it('does not render skeleton when not loading', () => {
      renderXPCard(makeStoreState({ loadingStats: false }));
      expect(screen.queryByTestId('skeleton')).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Compact mode
  // -------------------------------------------------------------------------

  describe('compact mode', () => {
    it('renders compact XP display without card wrapper when compact=true', () => {
      renderXPCard(
        makeStoreState({ xpStats: makeXPStats({ current_level: 3, total_xp: 500 }) }),
        null,
        { compact: true }
      );
      // No card wrapper in compact mode
      expect(screen.queryByTestId('card')).not.toBeInTheDocument();
      // Should still show level
      expect(screen.getByText('Level 3')).toBeInTheDocument();
    });

    it('compact mode formats XP with K suffix for large values', () => {
      renderXPCard(makeStoreState({ xpStats: makeXPStats({ total_xp: 15000 }) }), null, {
        compact: true,
      });
      expect(screen.getByText('15.0K XP')).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // View Achievements button
  // -------------------------------------------------------------------------

  describe('onViewAchievements', () => {
    it('renders achievements button when callback is provided', () => {
      const onViewAchievements = vi.fn();
      renderXPCard(makeStoreState(), null, { onViewAchievements });
      expect(screen.getByRole('button', { name: /View all achievements/i })).toBeInTheDocument();
    });

    it('does not render achievements button when no callback is provided', () => {
      renderXPCard(makeStoreState(), null, {});
      expect(
        screen.queryByRole('button', { name: /View all achievements/i })
      ).not.toBeInTheDocument();
    });
  });
});
