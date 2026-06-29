// src/components/dashboard/__tests__/DashboardGreeting.test.tsx
// Component tests for DashboardGreeting (DASH2-01-02).

import { describe, it, expect } from 'vitest';

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
