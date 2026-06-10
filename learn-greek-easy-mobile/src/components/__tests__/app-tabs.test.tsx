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
 *   Instead we test the placeholder screens directly — each one is a
 *   pure React component with no native dependencies, and together they
 *   prove the routes can render without crashing.
 *
 *   Decks graduated from placeholder to a real screen in MOB-07 — it is now
 *   covered by src/app/(app)/__tests__/decks-screen.test.tsx instead.
 *   Practice graduated from placeholder to a real screen in MOB-08 — it is now
 *   covered by src/app/(app)/__tests__/practice-screen.test.tsx instead.
 *   Culture graduated from placeholder to a real screen in MOB-10 — it is now
 *   covered by src/app/(app)/__tests__/culture-screen.test.tsx instead.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';

// ---------------------------------------------------------------------------
// Mocks needed for PracticeScreen (graduated from stub in MOB-08).
// ---------------------------------------------------------------------------

jest.mock('nativewind');
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/hooks/use-situations', () => ({
  useSituations: () => ({ data: undefined, isLoading: true, isError: false, refetch: jest.fn() }),
}));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));
jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  const ce = require('react').createElement;
  return { LinearGradient: ({ children, testID }: { children?: React.ReactNode; testID?: string }) => ce(View, { testID }, children) };
});
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  const ce = require('react').createElement;
  return {
    SafeAreaView: ({ children, testID, ...rest }: { children?: React.ReactNode; testID?: string; [k: string]: unknown }) => ce(View, { testID, ...rest }, children),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

// ---------------------------------------------------------------------------
// Mocks needed for CultureScreen (graduated from stub in MOB-10).
// ---------------------------------------------------------------------------

jest.mock('@/hooks/use-culture-readiness', () => ({
  useCultureReadiness: () => ({ data: undefined, isLoading: true, isError: false, refetch: jest.fn() }),
}));
jest.mock('@/hooks/use-culture-decks', () => ({
  useCultureDecks: () => ({ data: undefined, isLoading: true, isError: false, refetch: jest.fn() }),
}));
jest.mock('@/hooks/use-reduced-motion', () => ({
  useReducedMotion: () => false,
}));
jest.mock('@/components/ui/toast', () => ({
  useToast: () => ({ showComingSoonToast: jest.fn() }),
}));
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const NOOP = () => {};
  const createAnimatedComponent = (C: unknown) => C;
  return {
    __esModule: true,
    default: { View, createAnimatedComponent },
    useSharedValue: (init: unknown) => ({ value: init }),
    useAnimatedStyle: (fn: () => unknown) => fn(),
    useAnimatedProps: (fn: () => unknown) => fn(),
    withTiming: (toValue: unknown) => toValue,
    Animated: { View, createAnimatedComponent },
    Easing: { out: NOOP, quad: NOOP },
    runOnJS: (fn: (...args: unknown[]) => unknown) => fn,
    cancelAnimation: NOOP,
    createAnimatedComponent,
  };
});
jest.mock('react-native-svg', () => {
  const { View } = require('react-native');
  const ce = require('react').createElement;
  const stub = ({ children, testID }: { children?: React.ReactNode; testID?: string }) =>
    ce(View, { testID }, children);
  return { __esModule: true, default: stub, Circle: stub, Defs: stub, LinearGradient: stub, Stop: stub };
});
jest.mock('lucide-react-native', () => {
  const { View } = require('react-native');
  const ce = require('react').createElement;
  const stub = () => ce(View, { testID: 'icon-stub' });
  return { ChevronRight: stub };
});

// ---------------------------------------------------------------------------
// Screens
// ---------------------------------------------------------------------------
import PracticeScreen from '@/app/(app)/practice';
import CultureScreen from '@/app/(app)/culture';
import YouScreen from '@/app/(app)/you';

describe('Placeholder screens (DASH-11)', () => {
  it('PracticeScreen renders without crashing (loading state)', () => {
    // PracticeScreen is now a real screen (MOB-08); detailed tests in practice-screen.test.tsx.
    render(<PracticeScreen />);
    expect(screen.getByTestId('practice-loading')).toBeTruthy();
  });

  it('CultureScreen renders without crashing (loading state)', () => {
    // CultureScreen is now a real screen (MOB-10); detailed tests in culture-screen.test.tsx.
    render(<CultureScreen />);
    expect(screen.getByTestId('culture-loading')).toBeTruthy();
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
