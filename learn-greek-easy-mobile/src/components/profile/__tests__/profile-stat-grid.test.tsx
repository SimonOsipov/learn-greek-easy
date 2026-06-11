/// <reference types="jest" />
/**
 * Tests for ProfileStatGrid (src/components/profile/profile-stat-grid.tsx).
 *
 * Tests:
 *   1. Renders all four stat tiles with correct testIDs.
 *   2. Day streak shows raw number.
 *   3. Mastered shows "N words" suffix.
 *   4. Total time formats seconds correctly.
 *   5. Best streak shows "N days" suffix.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';

// ---------------------------------------------------------------------------
// Mocks — MUST precede any import that resolves the mocked module.
// ---------------------------------------------------------------------------

jest.mock('nativewind');

jest.mock('lucide-react-native', () => {
  const { View } = require('react-native');
  const ce = require('react').createElement;
  const stub = () => ce(View, { testID: 'icon-stub' });
  return { Flame: stub, Check: stub, Clock: stub, Trophy: stub };
});

import { ProfileStatGrid } from '@/components/profile/profile-stat-grid';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProfileStatGrid', () => {
  const baseProps = {
    currentStreak: 6,
    masteredCards: 142,
    allTimeSeconds: 4860, // 1h 21m
    bestStreak: 14,
  };

  it('renders all four stat tiles', () => {
    render(<ProfileStatGrid {...baseProps} />);
    expect(screen.getByTestId('profile-stat-streak')).toBeTruthy();
    expect(screen.getByTestId('profile-stat-mastered')).toBeTruthy();
    expect(screen.getByTestId('profile-stat-time')).toBeTruthy();
    expect(screen.getByTestId('profile-stat-best-streak')).toBeTruthy();
  });

  it('renders day streak value', () => {
    render(<ProfileStatGrid {...baseProps} />);
    expect(screen.getByTestId('profile-stat-streak-value')).toHaveTextContent('6');
  });

  it('renders mastered with words suffix', () => {
    render(<ProfileStatGrid {...baseProps} />);
    expect(screen.getByTestId('profile-stat-mastered-value')).toHaveTextContent('142 words');
  });

  it('formats allTimeSeconds into readable time', () => {
    render(<ProfileStatGrid {...baseProps} />);
    expect(screen.getByTestId('profile-stat-time-value')).toHaveTextContent('1h 21m');
  });

  it('renders best streak with days suffix', () => {
    render(<ProfileStatGrid {...baseProps} />);
    expect(screen.getByTestId('profile-stat-best-streak-value')).toHaveTextContent('14 days');
  });

  it('handles zero values gracefully', () => {
    render(
      <ProfileStatGrid
        currentStreak={0}
        masteredCards={0}
        allTimeSeconds={0}
        bestStreak={0}
      />,
    );
    expect(screen.getByTestId('profile-stat-streak-value')).toHaveTextContent('0');
    expect(screen.getByTestId('profile-stat-mastered-value')).toHaveTextContent('0 words');
    expect(screen.getByTestId('profile-stat-time-value')).toHaveTextContent('0m');
    expect(screen.getByTestId('profile-stat-best-streak-value')).toHaveTextContent('0 days');
  });
});
