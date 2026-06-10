/// <reference types="jest" />
/**
 * MOB-10 — RNTL screen tests for CultureScreen (src/app/(app)/culture.tsx).
 *
 * Tests:
 *   1. Loading → skeleton, no readiness card.
 *   2. Error → retry affordance, refetch on press.
 *   3. Loaded → title, subtitle, verdict, category bars, decks rail, drill rows.
 *   4. Mock exam CTA press → showComingSoonToast + analytics.
 *   5. Exam deck card press → showComingSoonToast + analytics.
 *   6. Drill row press → showComingSoonToast + analytics.
 *   7. Empty decks list → decks rail absent.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

// ---------------------------------------------------------------------------
// Mocks — MUST precede any import that resolves the mocked module.
// ---------------------------------------------------------------------------

jest.mock('nativewind');

// react-native-reanimated — minimal inline mock (reanimated native unavailable in jest)
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const NOOP = () => {};
  // createAnimatedComponent is called at module load time in readiness-donut.tsx
  // so it must return the component unchanged.
  const createAnimatedComponent = (C: unknown) => C;
  return {
    __esModule: true,
    default: {
      View,
      createAnimatedComponent,
    },
    useSharedValue: (init: unknown) => ({ value: init }),
    useAnimatedStyle: (fn: () => unknown) => fn(),
    useAnimatedProps: (fn: () => unknown) => fn(),
    withTiming: (toValue: unknown) => toValue,
    withSpring: (toValue: unknown) => toValue,
    Animated: { View, createAnimatedComponent },
    Easing: { out: NOOP, quad: NOOP },
    runOnJS: (fn: (...args: unknown[]) => unknown) => fn,
    cancelAnimation: NOOP,
    interpolate: NOOP,
    Extrapolation: { CLAMP: 'clamp' },
    createAnimatedComponent,
  };
});

// react-native-svg — stub all SVG elements as plain Views
jest.mock('react-native-svg', () => {
  const { View } = require('react-native');
  const ce = require('react').createElement;
  const stub = ({ children, testID }: { children?: React.ReactNode; testID?: string }) =>
    ce(View, { testID }, children);
  return {
    __esModule: true,
    default: stub, // Svg
    Circle: stub,
    Defs: stub,
    LinearGradient: stub,
    Stop: stub,
  };
});

// expo-linear-gradient — render children inside a plain View
jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  const ce = require('react').createElement;
  return {
    LinearGradient: ({
      children,
      testID,
    }: {
      children?: React.ReactNode;
      testID?: string;
    }) => ce(View, { testID }, children),
  };
});

// lucide-react-native — stub all icons
jest.mock('lucide-react-native', () => {
  const { View } = require('react-native');
  const ce = require('react').createElement;
  const stub = () => ce(View, { testID: 'icon-stub' });
  return { ChevronRight: stub };
});

// react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  const ce = require('react').createElement;
  return {
    SafeAreaView: ({
      children,
      testID,
      ...rest
    }: {
      children?: React.ReactNode;
      testID?: string;
      [k: string]: unknown;
    }) => ce(View, { testID, ...rest }, children),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

// hooks
const mockUseCultureReadiness = jest.fn();
jest.mock('@/hooks/use-culture-readiness', () => ({
  useCultureReadiness: () => mockUseCultureReadiness(),
}));

const mockUseCultureDecks = jest.fn();
jest.mock('@/hooks/use-culture-decks', () => ({
  useCultureDecks: () => mockUseCultureDecks(),
}));

jest.mock('@/hooks/use-reduced-motion', () => ({
  useReducedMotion: () => false,
}));

// useToast
const mockShowComingSoonToast = jest.fn();
jest.mock('@/components/ui/toast', () => ({
  useToast: () => ({ showComingSoonToast: mockShowComingSoonToast }),
}));

// analytics
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));

// ---------------------------------------------------------------------------
// Import subject AFTER all mocks.
// ---------------------------------------------------------------------------
import CultureScreen from '@/app/(app)/culture';
import { track } from '@/lib/analytics';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const READINESS_DATA = {
  overall: 46,
  categories: [
    { k: 'history',   l: 'History',   pct: 62 },
    { k: 'politics',  l: 'Politics',  pct: 38 },
    { k: 'geography', l: 'Geography', pct: 71 },
    { k: 'language',  l: 'Language',  pct: 24 },
    { k: 'society',   l: 'Society',   pct: 34 },
  ],
  verdict: 'getting_there' as const,
};

const DECKS_DATA = {
  items: [
    {
      id: 'exam-jul-25',
      name: "Cultural Exam Jul'25",
      name_en: null,
      exam_date: 'Jul 2025',
      question_count: 25,
      progress: { mastered: 0, total: 25, progress: 0.0 },
    },
    {
      id: 'exam-feb-25',
      name: "Cultural Exam Feb'25",
      name_en: null,
      exam_date: 'Feb 2025',
      question_count: 25,
      progress: { mastered: 3, total: 25, progress: 0.12 },
    },
  ],
  total: 2,
};

function setQueries({
  readinessLoading = false,
  readinessError = false,
  decksLoading = false,
  decksError = false,
}: {
  readinessLoading?: boolean;
  readinessError?: boolean;
  decksLoading?: boolean;
  decksError?: boolean;
} = {}) {
  mockUseCultureReadiness.mockReturnValue({
    data: readinessLoading || readinessError ? undefined : READINESS_DATA,
    isLoading: readinessLoading,
    isError: readinessError,
    refetch: jest.fn().mockResolvedValue(undefined),
  });
  mockUseCultureDecks.mockReturnValue({
    data: decksLoading || decksError ? undefined : DECKS_DATA,
    isLoading: decksLoading,
    isError: decksError,
    refetch: jest.fn().mockResolvedValue(undefined),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CultureScreen', () => {
  it('shows the skeleton while loading', () => {
    setQueries({ readinessLoading: true });
    render(<CultureScreen />);
    expect(screen.getByTestId('culture-loading')).toBeTruthy();
    expect(screen.queryByTestId('culture-readiness-card')).toBeNull();
  });

  it('shows error + retry when readiness fails', () => {
    setQueries({ readinessError: true });
    render(<CultureScreen />);
    expect(screen.getByTestId('culture-error')).toBeTruthy();
    fireEvent.press(screen.getByTestId('culture-error-retry'));
    expect(mockUseCultureReadiness.mock.results.at(-1)?.value.refetch).toHaveBeenCalled();
  });

  it('shows error + retry when decks fails', () => {
    setQueries({ decksError: true });
    render(<CultureScreen />);
    expect(screen.getByTestId('culture-error')).toBeTruthy();
  });

  it('renders title, subtitle, verdict and category bars when loaded', () => {
    setQueries();
    render(<CultureScreen />);

    expect(screen.getByTestId('culture-screen')).toBeTruthy();
    expect(screen.getByTestId('culture-title')).toHaveTextContent('Culture Exam');
    expect(screen.getByTestId('culture-subtitle')).toHaveTextContent(/target 60% to pass/);
    expect(screen.getByTestId('culture-verdict')).toHaveTextContent('Almost halfway');
    expect(screen.getByTestId('culture-readiness-card')).toBeTruthy();
    expect(screen.getByTestId('culture-category-bars')).toBeTruthy();
  });

  it('renders the deck rail when decks are present', () => {
    setQueries();
    render(<CultureScreen />);
    expect(screen.getByTestId('culture-decks-rail')).toBeTruthy();
    expect(screen.getByTestId('exam-deck-card-exam-jul-25')).toBeTruthy();
    expect(screen.getByTestId('exam-deck-card-exam-feb-25')).toBeTruthy();
  });

  it('renders drill topic rows', () => {
    setQueries();
    render(<CultureScreen />);
    expect(screen.getByTestId('culture-drill-rows')).toBeTruthy();
    expect(screen.getByTestId('topic-drill-row-history')).toBeTruthy();
    expect(screen.getByTestId('topic-drill-row-politics')).toBeTruthy();
    expect(screen.getByTestId('topic-drill-row-geography')).toBeTruthy();
  });

  it('mock exam CTA fires coming-soon toast + analytics', () => {
    setQueries();
    render(<CultureScreen />);
    fireEvent.press(screen.getByTestId('culture-mock-exam-cta'));
    expect(mockShowComingSoonToast).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith('culture_mock_exam_tapped', { coming_soon: true });
  });

  it('exam deck card press fires coming-soon toast + analytics', () => {
    setQueries();
    render(<CultureScreen />);
    fireEvent.press(screen.getByTestId('exam-deck-card-exam-jul-25'));
    expect(mockShowComingSoonToast).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith('culture_exam_deck_tapped', {
      deck_id: 'exam-jul-25',
      coming_soon: true,
    });
  });

  it('drill row press fires coming-soon toast + analytics', () => {
    setQueries();
    render(<CultureScreen />);
    fireEvent.press(screen.getByTestId('topic-drill-row-history'));
    expect(mockShowComingSoonToast).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith('culture_drill_topic_tapped', {
      topic_id: 'history',
      coming_soon: true,
    });
  });

  it('hides deck rail when no decks are available', () => {
    mockUseCultureReadiness.mockReturnValue({
      data: READINESS_DATA,
      isLoading: false,
      isError: false,
      refetch: jest.fn().mockResolvedValue(undefined),
    });
    mockUseCultureDecks.mockReturnValue({
      data: { items: [], total: 0 },
      isLoading: false,
      isError: false,
      refetch: jest.fn().mockResolvedValue(undefined),
    });
    render(<CultureScreen />);
    expect(screen.queryByTestId('culture-decks-rail')).toBeNull();
  });
});
