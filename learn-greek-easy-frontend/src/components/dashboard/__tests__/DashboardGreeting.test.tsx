// src/components/dashboard/__tests__/DashboardGreeting.test.tsx
// Component tests for DashboardGreeting (DASH2-01-02).
//
// PERF-15-05: week-heat bucketing moved server-side (summary.week_heat);
// this component now only RENDERS a heat array/todayIdx it's handed, so
// these tests pass `weekHeat` directly instead of raw `recentActivity` and
// no longer exercise the bucketing edge cases (UTC day-window boundaries,
// undefined cardsReviewed coercion) — those are covered by the backend's
// `test_dashboard_summary_derivations.py` (byte-parity port of the deleted
// `buildWeekHeat`/`weekHeat.ts`).

import { describe, it, expect } from 'vitest';

import { render, screen } from '@/lib/test-utils';

import { DashboardGreeting } from '../DashboardGreeting';

const ZERO_HEAT = { heat: [0, 0, 0, 0, 0, 0, 0], today_idx: 6 };

describe('DashboardGreeting', () => {
  it('renders the user name', () => {
    render(
      <DashboardGreeting
        userName="Nico"
        cardsDue={5}
        deckCount={2}
        minutesToday={10}
        weekHeat={ZERO_HEAT}
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
        weekHeat={ZERO_HEAT}
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
        weekHeat={ZERO_HEAT}
      />
    );
    expect(screen.getByText(/Welcome aboard/i)).toBeInTheDocument();
  });

  it('renders a skeleton (NOT the "Welcome aboard" copy) while loading, even when cardsDue defaults to 0', () => {
    // Regression: during the summary load `cardsDue` defaults to 0, which used
    // to flash the zero-due onboarding line on every refresh for users who
    // actually have due cards. isLoading must suppress the subtitle entirely.
    render(
      <DashboardGreeting
        userName="Nico"
        cardsDue={0}
        deckCount={0}
        minutesToday={0}
        weekHeat={ZERO_HEAT}
        isLoading
      />
    );
    expect(screen.queryByText(/Welcome aboard/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('greeting-sub-skeleton')).toBeInTheDocument();
  });

  it('minutes line shows real minutesToday and the UnwiredDot for the goal', () => {
    render(
      <DashboardGreeting
        userName="Nico"
        cardsDue={5}
        deckCount={1}
        minutesToday={12}
        weekHeat={ZERO_HEAT}
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

  it('heat strip is hidden when weekHeat is undefined (still loading)', () => {
    render(<DashboardGreeting userName="Nico" cardsDue={5} deckCount={1} minutesToday={0} />);
    expect(screen.queryByText(/this week/i)).not.toBeInTheDocument();
    expect(document.querySelectorAll('.db-week-cell')).toHaveLength(0);
  });

  it('heat strip is hidden when all heat buckets are zero', () => {
    render(
      <DashboardGreeting
        userName="Nico"
        cardsDue={5}
        deckCount={1}
        minutesToday={0}
        weekHeat={ZERO_HEAT}
      />
    );
    expect(screen.queryByText(/this week/i)).not.toBeInTheDocument();
    expect(document.querySelectorAll('.db-week-cell')).toHaveLength(0);
  });

  it('renders 7 cells with one .db-week-today and "reviews" wording when heat is non-empty', () => {
    // 5 reviews bucketed to intensity 3 at today's index (6); other days zero.
    render(
      <DashboardGreeting
        userName="Nico"
        cardsDue={5}
        deckCount={1}
        minutesToday={0}
        weekHeat={{ heat: [0, 0, 0, 0, 0, 0, 3], today_idx: 6 }}
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

  it('data-h + today marker line up with the given heat array and todayIdx', () => {
    // idx 0 gets bucket 5 (oldest day); today (idx 6) stays 0.
    render(
      <DashboardGreeting
        userName="Nico"
        cardsDue={5}
        deckCount={1}
        minutesToday={0}
        weekHeat={{ heat: [5, 0, 0, 0, 0, 0, 0], today_idx: 6 }}
      />
    );
    const cells = document.querySelectorAll('.db-week-cell');
    expect(cells).toHaveLength(7);
    expect(screen.getByText(/this week/i)).toBeInTheDocument();
    expect(cells[0].getAttribute('data-h')).toBe('5');
    expect(cells[6].getAttribute('data-h')).toBe('0');
  });
});
