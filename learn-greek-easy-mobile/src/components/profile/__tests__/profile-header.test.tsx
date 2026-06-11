/// <reference types="jest" />
/**
 * Tests for ProfileHeader component (src/components/profile/profile-header.tsx).
 *
 * Tests:
 *   1. Renders initials inside the gradient avatar when no avatarUrl.
 *   2. Renders a photo <Image> when avatarUrl is provided.
 *   3. Displays full name and level pill text.
 *   4. Displays the progress percentage text.
 *   5. Clamps progress to 0–100 when out of range.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';

// ---------------------------------------------------------------------------
// Mocks — MUST precede any import that resolves the mocked module.
// ---------------------------------------------------------------------------

jest.mock('nativewind');

jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  const ce = require('react').createElement;
  return {
    LinearGradient: ({
      children,
      testID,
      style,
    }: {
      children?: React.ReactNode;
      testID?: string;
      style?: object;
    }) => ce(View, { testID, style }, children),
  };
});

import { ProfileHeader } from '@/components/profile/profile-header';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProfileHeader', () => {
  const baseProps = {
    fullName: 'Maria Stavrou',
    initials: 'MS',
    levelName: 'Learner',
    progressPct: 62,
  };

  it('renders initials in gradient avatar when no avatarUrl', () => {
    render(<ProfileHeader {...baseProps} />);
    expect(screen.getByTestId('profile-avatar-gradient')).toBeTruthy();
    expect(screen.queryByTestId('profile-avatar-photo')).toBeNull();
    expect(screen.getByText('MS')).toBeTruthy();
  });

  it('renders photo image when avatarUrl is provided', () => {
    render(<ProfileHeader {...baseProps} avatarUrl="https://example.com/avatar.jpg" />);
    expect(screen.getByTestId('profile-avatar-photo')).toBeTruthy();
    expect(screen.queryByTestId('profile-avatar-gradient')).toBeNull();
  });

  it('displays full name and level pill', () => {
    render(<ProfileHeader {...baseProps} />);
    expect(screen.getByTestId('profile-full-name')).toHaveTextContent('Maria Stavrou');
    expect(screen.getByTestId('profile-level-pill')).toHaveTextContent('Learner');
  });

  it('displays generic "% to next level" copy when currentLevel not provided', () => {
    render(<ProfileHeader {...baseProps} progressPct={62.7} />);
    expect(screen.getByTestId('profile-level-progress-text')).toHaveTextContent('63% to next level');
  });

  it('shows "X% to Level N+1" when currentLevel is provided', () => {
    render(<ProfileHeader {...baseProps} progressPct={52} currentLevel={4} />);
    expect(screen.getByTestId('profile-level-progress-text')).toHaveTextContent('52% to Level 5');
  });

  it('shows "Max level" when currentLevel is at cap (15)', () => {
    render(<ProfileHeader {...baseProps} progressPct={100} currentLevel={15} />);
    expect(screen.getByTestId('profile-level-progress-text')).toHaveTextContent('Max level');
  });

  it('renders progress bar fill', () => {
    render(<ProfileHeader {...baseProps} progressPct={50} />);
    expect(screen.getByTestId('profile-progress-bar-track')).toBeTruthy();
    expect(screen.getByTestId('profile-progress-bar-fill')).toBeTruthy();
  });

  it('clamps progress below 0 to 0', () => {
    render(<ProfileHeader {...baseProps} progressPct={-10} />);
    expect(screen.getByTestId('profile-level-progress-text')).toHaveTextContent('0% to next level');
  });

  it('clamps progress above 100 to 100', () => {
    render(<ProfileHeader {...baseProps} progressPct={120} />);
    expect(screen.getByTestId('profile-level-progress-text')).toHaveTextContent('100% to next level');
  });
});
