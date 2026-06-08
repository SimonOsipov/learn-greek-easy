/// <reference types="jest" />
/**
 * DASH-11 — Tests for the 5-tab shell.
 *
 * Why we don't test NativeTabs render directly:
 *   `expo-router/unstable-native-tabs` renders through a native iOS/Android
 *   bottom-tabs navigator that requires the full Expo native runtime. Under
 *   jest-expo (Node + jsdom-like environment) the NativeBottomTabsNavigator
 *   hits missing native modules and cannot mount. Attempting to render
 *   <AppTabs /> in Jest would require a brittle full-navigator mock that would
 *   re-test framework internals rather than our code.
 *
 *   Instead we test the four new placeholder screens directly — each one is a
 *   pure React component with no native dependencies, and together they
 *   prove the four new routes can render without crashing.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';

// ---------------------------------------------------------------------------
// Placeholder screens introduced in DASH-11
// ---------------------------------------------------------------------------
import DecksScreen from '@/app/(app)/decks';
import PracticeScreen from '@/app/(app)/practice';
import CultureScreen from '@/app/(app)/culture';
import YouScreen from '@/app/(app)/you';

describe('Placeholder screens (DASH-11)', () => {
  it('DecksScreen renders the "Decks" title', () => {
    render(<DecksScreen />);
    expect(screen.getByText('Decks')).toBeTruthy();
  });

  it('DecksScreen renders the "Coming soon" subtitle', () => {
    render(<DecksScreen />);
    expect(screen.getByText('Coming soon')).toBeTruthy();
  });

  it('PracticeScreen renders the "Practice" title', () => {
    render(<PracticeScreen />);
    expect(screen.getByText('Practice')).toBeTruthy();
  });

  it('PracticeScreen renders the "Coming soon" subtitle', () => {
    render(<PracticeScreen />);
    expect(screen.getByText('Coming soon')).toBeTruthy();
  });

  it('CultureScreen renders the "Culture" title', () => {
    render(<CultureScreen />);
    expect(screen.getByText('Culture')).toBeTruthy();
  });

  it('CultureScreen renders the "Coming soon" subtitle', () => {
    render(<CultureScreen />);
    expect(screen.getByText('Coming soon')).toBeTruthy();
  });

  it('YouScreen renders the "You" title', () => {
    render(<YouScreen />);
    expect(screen.getByText('You')).toBeTruthy();
  });

  it('YouScreen renders the "Coming soon" subtitle', () => {
    render(<YouScreen />);
    expect(screen.getByText('Coming soon')).toBeTruthy();
  });
});
