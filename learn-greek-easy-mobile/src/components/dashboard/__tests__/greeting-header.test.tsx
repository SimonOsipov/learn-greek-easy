/// <reference types="jest" />
/**
 * DASH-05 — RNTL component tests for GreetingHeader, WeekHeatmap, and ProgressBand.
 *
 * Covers:
 *   GreetingHeader
 *     1. morning bucket → "GOOD MORNING" kicker
 *     2. afternoon bucket → "GOOD AFTERNOON" kicker
 *     3. evening bucket → "GOOD EVENING" kicker
 *     4. firstName provided → name visible after "Γεια σου,"
 *     5. firstName null → no name, just "Γεια σου" (no comma)
 *     6. firstName empty string → treated as null (no name)
 *     7. streak=0 renders without crash
 *     8. onAvatarPress wired (avatar Pressable exists)
 *
 *   WeekHeatmap
 *     9.  renders exactly 7 cells
 *     10. all-zeros input renders without crash
 *     11. todayIndex marks today cell
 *     12. no todayIndex → no today-cell testID
 *     13. short heat array (< 7) does NOT crash (padding guard)
 *
 *   ProgressBand
 *     14. renders summary and heatmap with zeroed data — no crash
 *     15. renders dueToday count in summary text
 *     16. renders deckCount when provided
 *     17. renders goal phrase when minutesToday + minutesGoal provided
 *     18. omits goal phrase when minutesGoal is undefined
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';

jest.mock('nativewind');

import { GreetingHeader } from '@/components/dashboard/greeting-header';
import { WeekHeatmap } from '@/components/dashboard/week-heatmap';
import { ProgressBand } from '@/components/dashboard/progress-band';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const ZERO_HEAT: number[] = [0, 0, 0, 0, 0, 0, 0];

// ---------------------------------------------------------------------------
// GreetingHeader
// ---------------------------------------------------------------------------

describe('GreetingHeader', () => {
  it('morning bucket → kicker text contains "MORNING"', () => {
    render(
      <GreetingHeader greeting="morning" firstName="Maria" streak={6} />,
    );
    expect(screen.getByTestId('greeting-kicker').props.children).toMatch(/MORNING/i);
  });

  it('afternoon bucket → kicker text contains "AFTERNOON"', () => {
    render(
      <GreetingHeader greeting="afternoon" firstName="Maria" streak={6} />,
    );
    expect(screen.getByTestId('greeting-kicker').props.children).toMatch(/AFTERNOON/i);
  });

  it('evening bucket → kicker text contains "EVENING"', () => {
    render(
      <GreetingHeader greeting="evening" firstName="Maria" streak={6} />,
    );
    expect(screen.getByTestId('greeting-kicker').props.children).toMatch(/EVENING/i);
  });

  it('firstName provided → name is rendered', () => {
    render(
      <GreetingHeader greeting="morning" firstName="Maria" streak={6} />,
    );
    expect(screen.getByTestId('greeting-name')).toBeTruthy();
    expect(screen.getByTestId('greeting-name').props.children).toBe('Maria');
  });

  it('firstName provided → Greek greeting includes comma ("Γεια σου,")', () => {
    render(
      <GreetingHeader greeting="morning" firstName="Maria" streak={6} />,
    );
    expect(screen.getByTestId('greeting-greek').props.children).toBe('Γεια σου,');
  });

  it('firstName null → no greeting-name node', () => {
    render(
      <GreetingHeader greeting="morning" firstName={null} streak={6} />,
    );
    expect(screen.queryByTestId('greeting-name')).toBeNull();
  });

  it('firstName null → Greek greeting has no comma ("Γεια σου")', () => {
    render(
      <GreetingHeader greeting="morning" firstName={null} streak={6} />,
    );
    expect(screen.getByTestId('greeting-greek').props.children).toBe('Γεια σου');
  });

  it('firstName empty string → treated as null (no name rendered)', () => {
    render(
      <GreetingHeader greeting="morning" firstName="" streak={6} />,
    );
    expect(screen.queryByTestId('greeting-name')).toBeNull();
    expect(screen.getByTestId('greeting-greek').props.children).toBe('Γεια σου');
  });

  it('streak=0 renders without crash', () => {
    render(
      <GreetingHeader greeting="morning" firstName={null} streak={0} />,
    );
    expect(screen.getByTestId('streak-chip')).toBeTruthy();
    expect(screen.getByTestId('streak-count').props.children).toBe(0);
  });

  it('avatar Pressable is present', () => {
    render(
      <GreetingHeader greeting="morning" firstName="Maria" streak={6} initials="MS" />,
    );
    expect(screen.getByTestId('avatar-button')).toBeTruthy();
    expect(screen.getByTestId('avatar-initials').props.children).toBe('MS');
  });

  it('avatar falls back to "?" when initials is null', () => {
    render(
      <GreetingHeader greeting="morning" firstName="Maria" streak={6} initials={null} />,
    );
    expect(screen.getByTestId('avatar-initials').props.children).toBe('?');
  });
});

// ---------------------------------------------------------------------------
// WeekHeatmap
// ---------------------------------------------------------------------------

describe('WeekHeatmap', () => {
  it('renders exactly 7 cells', () => {
    render(<WeekHeatmap heat={[4, 1, 0, 3, 2, 5, 2]} />);
    // Each cell has testID `heatmap-cell-<i>`
    for (let i = 0; i < 7; i++) {
      expect(screen.getByTestId(`heatmap-cell-${i}`)).toBeTruthy();
    }
  });

  it('all-zeros input renders without crash', () => {
    expect(() => render(<WeekHeatmap heat={ZERO_HEAT} />)).not.toThrow();
    expect(screen.getByTestId('week-heatmap')).toBeTruthy();
  });

  it('todayIndex marks the today cell with testID "heatmap-today-cell"', () => {
    render(<WeekHeatmap heat={[4, 1, 0, 3, 2, 5, 2]} todayIndex={5} />);
    expect(screen.getByTestId('heatmap-today-cell')).toBeTruthy();
  });

  it('no todayIndex → no "heatmap-today-cell" node', () => {
    render(<WeekHeatmap heat={ZERO_HEAT} />);
    expect(screen.queryByTestId('heatmap-today-cell')).toBeNull();
  });

  it('short heat array (< 7) pads without crashing', () => {
    expect(() => render(<WeekHeatmap heat={[1, 2, 3]} />)).not.toThrow();
    // Should still render 7 cells (padding guard)
    for (let i = 0; i < 7; i++) {
      expect(screen.getByTestId(`heatmap-cell-${i}`)).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// ProgressBand
// ---------------------------------------------------------------------------

describe('ProgressBand', () => {
  it('renders without crash on zeroed/empty data', () => {
    expect(() =>
      render(<ProgressBand dueToday={0} heat={ZERO_HEAT} />),
    ).not.toThrow();
    expect(screen.getByTestId('progress-band')).toBeTruthy();
  });

  it('renders the progress summary text', () => {
    render(<ProgressBand dueToday={0} heat={ZERO_HEAT} />);
    expect(screen.getByTestId('progress-summary')).toBeTruthy();
  });

  it('renders dueToday count in summary', () => {
    render(<ProgressBand dueToday={130} heat={ZERO_HEAT} />);
    // The bold count text node renders as a child within the summary
    expect(screen.getByText('130 cards')).toBeTruthy();
  });

  it('renders deckCount when provided', () => {
    render(<ProgressBand dueToday={130} deckCount={3} heat={ZERO_HEAT} />);
    expect(screen.getByText('3 decks')).toBeTruthy();
  });

  it('renders goal phrase when minutesToday + minutesGoal provided', () => {
    render(
      <ProgressBand
        dueToday={130}
        minutesToday={12}
        minutesGoal={20}
        heat={ZERO_HEAT}
      />,
    );
    expect(screen.getByText('20 min')).toBeTruthy();
    expect(screen.getByText('12 min')).toBeTruthy();
  });

  it('omits goal phrase when minutesGoal is undefined', () => {
    render(<ProgressBand dueToday={0} minutesToday={12} heat={ZERO_HEAT} />);
    // Neither "20 min" nor "12 min" should appear — no goal to show
    expect(screen.queryByText('12 min')).toBeNull();
  });

  it('renders the heatmap', () => {
    render(<ProgressBand dueToday={0} heat={ZERO_HEAT} />);
    expect(screen.getByTestId('week-heatmap')).toBeTruthy();
  });
});
