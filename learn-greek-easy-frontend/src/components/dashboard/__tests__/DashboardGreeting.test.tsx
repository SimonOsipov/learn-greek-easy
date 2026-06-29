// src/components/dashboard/__tests__/DashboardGreeting.test.tsx
// Component tests for DashboardGreeting (DASH2-01-02).

import { describe, it, expect, vi, afterEach } from 'vitest';

import { render, screen } from '@/lib/test-utils';

import { DashboardGreeting } from '../DashboardGreeting';
import type { DashboardGreetingProps } from '../DashboardGreeting';

// Fixed "now" for buildWeekHeat — 2026-06-29 10:00 UTC
// heat strip test uses activity entries landing in the window
const NOW_ISO = '2026-06-29T10:00:00Z';

function makeActivity(
  entries: Array<{ timestamp: string; cardsReviewed: number }>
): DashboardGreetingProps['recentActivity'] {
  return entries.map((e, i) => ({
    activityId: `a-${i}`,
    type: 'review_session' as const,
    timestamp: new Date(e.timestamp),
    relativeTime: 'Today',
    title: `Reviewed ${e.cardsReviewed} cards`,
    description: `${e.cardsReviewed} cards`,
    cardsReviewed: e.cardsReviewed,
    accuracy: 80,
    icon: 'book-open',
    color: 'blue',
  }));
}

// Restore real timers after any test that calls vi.setSystemTime.
afterEach(() => {
  vi.useRealTimers();
});

describe('DashboardGreeting', () => {
  it('renders the user name', () => {
    render(
      <DashboardGreeting
        userName="Nico"
        cardsDue={5}
        deckCount={2}
        minutesToday={10}
        recentActivity={[]}
      />
    );
    expect(screen.getByText(/Nico/)).toBeInTheDocument();
  });

  it('subline shows N cards and M decks when cardsDue > 0', () => {
    render(
      <DashboardGreeting
        userName="Nico"
        cardsDue={8}
        deckCount={3}
        minutesToday={5}
        recentActivity={[]}
      />
    );
    // N cards and M decks appear as bolded text inside the subline
    const subline = screen.getByText(/8 cards/);
    expect(subline).toBeInTheDocument();
    const deckRef = screen.getByText(/3 decks/);
    expect(deckRef).toBeInTheDocument();
  });

  it('shows the welcome copy when cardsDue is 0', () => {
    render(
      <DashboardGreeting
        userName="Nico"
        cardsDue={0}
        deckCount={0}
        minutesToday={0}
        recentActivity={[]}
      />
    );
    expect(screen.getByText(/Welcome aboard/i)).toBeInTheDocument();
  });

  it('minutes line shows real minutesToday and the UnwiredDot for the goal', () => {
    render(
      <DashboardGreeting
        userName="Nico"
        cardsDue={5}
        deckCount={1}
        minutesToday={12}
        recentActivity={[]}
      />
    );
    // Real minutes appear
    expect(screen.getByText(/12 min/)).toBeInTheDocument();
    // UnwiredDot is rendered (data-testid="unwired-dot")
    const dot = screen.getByTestId('unwired-dot');
    expect(dot).toBeInTheDocument();
    // The goal inside UnwiredDot should NOT contain a real number
    expect(dot.textContent).not.toMatch(/^\d+/);
  });

  it('heat strip is hidden when all activity is zero', () => {
    render(
      <DashboardGreeting
        userName="Nico"
        cardsDue={5}
        deckCount={1}
        minutesToday={0}
        recentActivity={[]}
      />
    );
    expect(screen.queryByText(/this week/i)).not.toBeInTheDocument();
    expect(document.querySelectorAll('.db-week-cell')).toHaveLength(0);
  });

  it('renders 7 cells with one .db-week-today and "reviews" wording when heat is non-empty', () => {
    // Pin system time so buildWeekHeat()'s `new Date()` matches the fixture timestamp.
    // Without this, the test breaks the day after NOW_ISO (the activity falls outside
    // the 7-day window and the strip is hidden). QA-DASH2-01-02.
    vi.setSystemTime(new Date(NOW_ISO));

    // 5 reviews today lands at idx 6 → bucket 3; other days zero
    const activity = makeActivity([{ timestamp: NOW_ISO, cardsReviewed: 5 }]);
    render(
      <DashboardGreeting
        userName="Nico"
        cardsDue={5}
        deckCount={1}
        minutesToday={0}
        recentActivity={activity}
      />
    );

    // Heat strip visible
    expect(screen.getByText(/this week/i)).toBeInTheDocument();

    // Exactly 7 cells
    const cells = document.querySelectorAll('.db-week-cell');
    expect(cells).toHaveLength(7);

    // Exactly one "today" cell
    const todayCells = document.querySelectorAll('.db-week-today');
    expect(todayCells).toHaveLength(1);

    // Cell titles/aria contain "review" (not "session")
    const allTitles = Array.from(cells).map((c) => c.getAttribute('title') ?? '');
    const allAriaLabels = Array.from(cells).map((c) => c.getAttribute('aria-label') ?? '');
    const hasSessions = [...allTitles, ...allAriaLabels].some((s) => s.includes('session'));
    expect(hasSessions).toBe(false);
    const hasReviews = [...allTitles, ...allAriaLabels].some((s) => s.includes('review'));
    expect(hasReviews).toBe(true);
  });
});

// ── Adversarial edge cases (QA-DASH2-01-02) ──────────────────────────────────

describe('DashboardGreeting — adversarial', () => {
  it('activity with cardsReviewed=undefined still renders without throwing', () => {
    // AnalyticsActivityItem.cardsReviewed is optional (?). The component
    // defensively coerces it: `a.cardsReviewed ?? 0`. Confirm no throw + no heat.
    vi.setSystemTime(new Date(NOW_ISO));
    const activity: DashboardGreetingProps['recentActivity'] = [
      {
        activityId: 'a-undef',
        type: 'review_session',
        timestamp: new Date(NOW_ISO),
        relativeTime: 'Today',
        title: 'Reviewed undefined cards',
        description: 'undefined% accuracy',
        cardsReviewed: undefined,
        accuracy: 0,
        icon: 'book-open',
        color: 'blue',
      },
    ];
    render(
      <DashboardGreeting
        userName="Nico"
        cardsDue={3}
        deckCount={1}
        minutesToday={0}
        recentActivity={activity}
      />
    );
    // Should render the user name without throwing
    expect(screen.getByText(/Nico/)).toBeInTheDocument();
    // cardsReviewed=undefined → coerced to 0 → heat[6]=0 → hasHeat=false → no strip
    expect(document.querySelectorAll('.db-week-cell')).toHaveLength(0);
  });

  it('heat strip is hidden when only out-of-window activity exists (activity 8 days ago)', () => {
    // 8 days old should be excluded; heat = all zeros → strip hidden.
    vi.setSystemTime(new Date(NOW_ISO));
    const activity = makeActivity([
      { timestamp: '2026-06-21T10:00:00Z', cardsReviewed: 15 }, // 8 days before 2026-06-29
    ]);
    render(
      <DashboardGreeting
        userName="Nico"
        cardsDue={5}
        deckCount={1}
        minutesToday={0}
        recentActivity={activity}
      />
    );
    // out-of-window → hasHeat=false
    expect(document.querySelectorAll('.db-week-cell')).toHaveLength(0);
    expect(screen.queryByText(/this week/i)).not.toBeInTheDocument();
  });

  it('heat strip shows when activity is exactly 6 days ago (oldest included day)', () => {
    // 6 days before 2026-06-29 = 2026-06-23 → idx 0 in the window.
    vi.setSystemTime(new Date(NOW_ISO));
    const activity = makeActivity([
      { timestamp: '2026-06-23T12:00:00Z', cardsReviewed: 13 }, // → bucket 5
    ]);
    render(
      <DashboardGreeting
        userName="Nico"
        cardsDue={5}
        deckCount={1}
        minutesToday={0}
        recentActivity={activity}
      />
    );
    // idx 0 is in the window → hasHeat=true
    const cells = document.querySelectorAll('.db-week-cell');
    expect(cells).toHaveLength(7);
    expect(screen.getByText(/this week/i)).toBeInTheDocument();
    // idx 0 cell gets data-h=5; today (idx 6) gets data-h=0
    expect(cells[0].getAttribute('data-h')).toBe('5');
    expect(cells[6].getAttribute('data-h')).toBe('0');
  });
});
