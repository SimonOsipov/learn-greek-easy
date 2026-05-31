/**
 * StreakWidget Component Tests
 *
 * Tests for the StreakWidget component covering:
 * - isStreakActive: active when studied today (0 days diff)
 * - isStreakActive: active when studied yesterday (1 day diff)
 * - isStreakActive: inactive when studied 2+ days ago
 * - isStreakActive: timezone-safe midnight floor via injected clock
 * - getMessage: all tier messages (0, 1, 2-6, 7-29, 30+)
 * - Loading skeleton rendering
 * - Active/inactive visual states (border, flame colour)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StreakWidget } from '../StreakWidget';

// ---------------------------------------------------------------------------
// Mock useStudyStreak
// ---------------------------------------------------------------------------

const mockUseStudyStreak = vi.fn();
vi.mock('@/hooks/useStudyStreak', () => ({
  useStudyStreak: () => mockUseStudyStreak(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a date that is `daysAgo` days before the pinned "now". */
function daysAgoFrom(now: Date, daysAgo: number): Date {
  const d = new Date(now);
  d.setDate(d.getDate() - daysAgo);
  return d;
}

function renderWidget() {
  return render(<StreakWidget />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('StreakWidget', () => {
  // Pinned clock: 2024-03-15 noon UTC — safely mid-day so midnight floor is clear.
  const NOW = new Date('2024-03-15T12:00:00.000Z');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    mockUseStudyStreak.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  describe('loading skeleton', () => {
    it('renders a skeleton when isLoading prop is true', () => {
      mockUseStudyStreak.mockReturnValue({ streak: null, loading: false, error: null });
      const { container } = render(<StreakWidget isLoading />);
      // The Skeleton component renders a div with animate-pulse class
      const skeleton = container.querySelector('.animate-pulse');
      expect(skeleton).not.toBeNull();
    });

    it('renders a skeleton when hook loading is true', () => {
      mockUseStudyStreak.mockReturnValue({ streak: null, loading: true, error: null });
      const { container } = renderWidget();
      const skeleton = container.querySelector('.animate-pulse');
      expect(skeleton).not.toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // isStreakActive — via visual indicators
  // -------------------------------------------------------------------------

  describe('isStreakActive', () => {
    it('is active when lastActivityDate is today (0 days diff) — orange border present', () => {
      const todayActivity = daysAgoFrom(NOW, 0); // same day as NOW
      mockUseStudyStreak.mockReturnValue({
        streak: { currentStreak: 3, longestStreak: 5, lastActivityDate: todayActivity },
        loading: false,
        error: null,
      });
      const { container } = renderWidget();
      const card = container.firstElementChild;
      expect(card?.className).toContain('border-orange-500');
    });

    it('is active when lastActivityDate is yesterday (1 day diff) — orange border present', () => {
      const yesterdayActivity = daysAgoFrom(NOW, 1);
      mockUseStudyStreak.mockReturnValue({
        streak: { currentStreak: 5, longestStreak: 10, lastActivityDate: yesterdayActivity },
        loading: false,
        error: null,
      });
      const { container } = renderWidget();
      const card = container.firstElementChild;
      expect(card?.className).toContain('border-orange-500');
    });

    it('is inactive when lastActivityDate is 2 days ago — no orange border', () => {
      const twoDaysAgo = daysAgoFrom(NOW, 2);
      mockUseStudyStreak.mockReturnValue({
        streak: { currentStreak: 5, longestStreak: 10, lastActivityDate: twoDaysAgo },
        loading: false,
        error: null,
      });
      const { container } = renderWidget();
      const card = container.firstElementChild;
      expect(card?.className).not.toContain('border-orange-500');
    });

    it('is inactive when lastActivityDate is 7 days ago — no orange border', () => {
      const sevenDaysAgo = daysAgoFrom(NOW, 7);
      mockUseStudyStreak.mockReturnValue({
        streak: { currentStreak: 3, longestStreak: 10, lastActivityDate: sevenDaysAgo },
        loading: false,
        error: null,
      });
      const { container } = renderWidget();
      const card = container.firstElementChild;
      expect(card?.className).not.toContain('border-orange-500');
    });

    it('is inactive when currentStreak is 0 regardless of lastActivityDate', () => {
      mockUseStudyStreak.mockReturnValue({
        streak: { currentStreak: 0, longestStreak: 5, lastActivityDate: daysAgoFrom(NOW, 0) },
        loading: false,
        error: null,
      });
      const { container } = renderWidget();
      const card = container.firstElementChild;
      expect(card?.className).not.toContain('border-orange-500');
    });

    it('is inactive when streak is null (no data)', () => {
      mockUseStudyStreak.mockReturnValue({ streak: null, loading: false, error: null });
      const { container } = renderWidget();
      const card = container.firstElementChild;
      expect(card?.className).not.toContain('border-orange-500');
    });

    it('midnight boundary: activity at 23:59 the day before is 1 day diff — still active', () => {
      // Pin clock to just after midnight: 2024-03-15 00:01 UTC
      vi.setSystemTime(new Date('2024-03-15T00:01:00.000Z'));
      // Activity at 2024-03-14 23:59 UTC → floor to 2024-03-14 → 1 day behind → active
      const justBeforeMidnight = new Date('2024-03-14T23:59:00.000Z');
      mockUseStudyStreak.mockReturnValue({
        streak: { currentStreak: 2, longestStreak: 5, lastActivityDate: justBeforeMidnight },
        loading: false,
        error: null,
      });
      const { container } = renderWidget();
      const card = container.firstElementChild;
      expect(card?.className).toContain('border-orange-500');
    });
  });

  // -------------------------------------------------------------------------
  // Flame icon colour reflects active state
  // -------------------------------------------------------------------------

  describe('flame icon active/inactive', () => {
    it('shows orange flame when active', () => {
      mockUseStudyStreak.mockReturnValue({
        streak: { currentStreak: 3, longestStreak: 5, lastActivityDate: daysAgoFrom(NOW, 0) },
        loading: false,
        error: null,
      });
      const { container } = renderWidget();
      const flame = container.querySelector('svg');
      const cls = flame?.className?.baseVal ?? flame?.getAttribute('class') ?? '';
      expect(cls).toContain('text-orange-500');
    });

    it('shows muted flame when inactive', () => {
      mockUseStudyStreak.mockReturnValue({
        streak: { currentStreak: 0, longestStreak: 5, lastActivityDate: null },
        loading: false,
        error: null,
      });
      const { container } = renderWidget();
      const flame = container.querySelector('svg');
      const cls = flame?.className?.baseVal ?? flame?.getAttribute('class') ?? '';
      expect(cls).toContain('text-muted-foreground');
    });
  });

  // -------------------------------------------------------------------------
  // getMessage — via motivational text in the rendered widget
  // -------------------------------------------------------------------------

  describe('getMessage tiers', () => {
    /** Render with a streak that is active today so isActive=true. */
    function renderWithActiveStreak(currentStreak: number) {
      mockUseStudyStreak.mockReturnValue({
        streak: {
          currentStreak,
          longestStreak: currentStreak,
          lastActivityDate: daysAgoFrom(NOW, 0),
        },
        loading: false,
        error: null,
      });
      return renderWidget();
    }

    it('tier 0 — shows "Start studying to build your streak!"', () => {
      mockUseStudyStreak.mockReturnValue({
        streak: { currentStreak: 0, longestStreak: 0, lastActivityDate: null },
        loading: false,
        error: null,
      });
      renderWidget();
      expect(screen.getByText('Start studying to build your streak!')).toBeInTheDocument();
    });

    it('inactive streak (currentStreak=5 but 3 days ago) — shows "Start studying" message', () => {
      mockUseStudyStreak.mockReturnValue({
        streak: {
          currentStreak: 5,
          longestStreak: 10,
          lastActivityDate: daysAgoFrom(NOW, 3),
        },
        loading: false,
        error: null,
      });
      renderWidget();
      expect(screen.getByText('Start studying to build your streak!')).toBeInTheDocument();
    });

    it('tier 1 (streak=1, active) — shows "Great start! Come back tomorrow!"', () => {
      renderWithActiveStreak(1);
      expect(screen.getByText('Great start! Come back tomorrow!')).toBeInTheDocument();
    });

    it('tier 2-6 (streak=2, active) — shows "Keep going! You\'re building momentum!"', () => {
      renderWithActiveStreak(2);
      expect(screen.getByText("Keep going! You're building momentum!")).toBeInTheDocument();
    });

    it('tier 2-6 boundary (streak=6, active) — shows "Keep going! You\'re building momentum!"', () => {
      renderWithActiveStreak(6);
      expect(screen.getByText("Keep going! You're building momentum!")).toBeInTheDocument();
    });

    it('tier 7-29 (streak=7, active) — shows "Amazing! You\'re on fire!"', () => {
      renderWithActiveStreak(7);
      expect(screen.getByText("Amazing! You're on fire!")).toBeInTheDocument();
    });

    it('tier 7-29 boundary (streak=29, active) — shows "Amazing! You\'re on fire!"', () => {
      renderWithActiveStreak(29);
      expect(screen.getByText("Amazing! You're on fire!")).toBeInTheDocument();
    });

    it('tier 30+ (streak=30, active) — shows "Incredible dedication! Keep it up!"', () => {
      renderWithActiveStreak(30);
      expect(screen.getByText('Incredible dedication! Keep it up!')).toBeInTheDocument();
    });

    it('tier 30+ (streak=100, active) — shows "Incredible dedication! Keep it up!"', () => {
      renderWithActiveStreak(100);
      expect(screen.getByText('Incredible dedication! Keep it up!')).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Streak count display
  // -------------------------------------------------------------------------

  describe('streak count display', () => {
    it('shows currentStreak and longestStreak numbers', () => {
      mockUseStudyStreak.mockReturnValue({
        streak: { currentStreak: 7, longestStreak: 14, lastActivityDate: daysAgoFrom(NOW, 0) },
        loading: false,
        error: null,
      });
      const { container } = renderWidget();
      expect(container.textContent).toContain('7');
      expect(container.textContent).toContain('14');
    });

    it('displays "day" (singular) when currentStreak is 1', () => {
      mockUseStudyStreak.mockReturnValue({
        streak: { currentStreak: 1, longestStreak: 1, lastActivityDate: daysAgoFrom(NOW, 0) },
        loading: false,
        error: null,
      });
      renderWidget();
      // The component renders <span>1</span><span>day</span> — use getByText to match the span text
      expect(screen.getByText('day')).toBeInTheDocument();
      // And "days" plural should NOT be present in that span
      expect(screen.queryByText('days')).toBeNull();
    });

    it('displays "days" (plural) when currentStreak is 5', () => {
      mockUseStudyStreak.mockReturnValue({
        streak: { currentStreak: 5, longestStreak: 5, lastActivityDate: daysAgoFrom(NOW, 0) },
        loading: false,
        error: null,
      });
      const { container } = renderWidget();
      expect(container.textContent).toContain('5');
      expect(container.textContent).toContain('days');
    });

    it('shows zeros when streak is null (no data)', () => {
      mockUseStudyStreak.mockReturnValue({ streak: null, loading: false, error: null });
      const { container } = renderWidget();
      expect(container.textContent).toContain('0');
    });
  });
});
