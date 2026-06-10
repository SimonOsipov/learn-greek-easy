/// <reference types="jest" />
/**
 * Tests for WeekHeatmapCard (src/components/profile/week-heatmap-card.tsx).
 *
 * Tests:
 *   1. Renders the kicker label "This week".
 *   2. Renders the correct summary line from sessions + time.
 *   3. Renders the inner WeekHeatmap (testID="week-heatmap").
 *   4. Zero-activity week shows "0 sessions · 0m".
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';

// ---------------------------------------------------------------------------
// Mocks — MUST precede any import that resolves the mocked module.
// ---------------------------------------------------------------------------

jest.mock('nativewind');

import { WeekHeatmapCard } from '@/components/profile/week-heatmap-card';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WeekHeatmapCard', () => {
  const baseProps = {
    heat: [0, 2, 5, 0, 3, 1, 4],
    todayIndex: 4, // Friday
    totalSessions: 17,
    totalStudySeconds: 4860, // 1h 21m
  };

  it('renders the "This week" kicker', () => {
    render(<WeekHeatmapCard {...baseProps} />);
    expect(screen.getByTestId('heatmap-card-kicker')).toHaveTextContent('This week');
  });

  it('renders the correct summary line', () => {
    render(<WeekHeatmapCard {...baseProps} />);
    expect(screen.getByTestId('heatmap-card-summary')).toHaveTextContent('17 sessions · 1h 21m');
  });

  it('renders the inner WeekHeatmap', () => {
    render(<WeekHeatmapCard {...baseProps} />);
    expect(screen.getByTestId('week-heatmap')).toBeTruthy();
  });

  it('shows 0 sessions and 0m for inactive week', () => {
    render(
      <WeekHeatmapCard
        heat={[0, 0, 0, 0, 0, 0, 0]}
        todayIndex={0}
        totalSessions={0}
        totalStudySeconds={0}
      />,
    );
    expect(screen.getByTestId('heatmap-card-summary')).toHaveTextContent('0 sessions · 0m');
  });
});
