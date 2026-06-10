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
// Fixtures — verbatim backend shapes (culture.py CultureReadinessResponse /
// CultureDeckListResponse). These deliberately use snake_case field names from
// the real API, not the fabricated ones.
// ---------------------------------------------------------------------------

const READINESS_DATA = {
  readiness_percentage: 46,
  verdict: 'getting_there' as const,
  questions_learned: 23,
  questions_total: 50,
  accuracy_percentage: 71.4,
  total_answers: 35,
  categories: [
    {
      category: 'history',
      readiness_percentage: 62,
      questions_mastered: 13,
      questions_total: 21,
      deck_ids: ['deck-hist-1'],
      accuracy_percentage: 75.0,
      needs_reinforcement: false,
    },
    {
      category: 'politics',
      readiness_percentage: 38,
      questions_mastered: 4,
      questions_total: 10,
      deck_ids: ['deck-pol-1'],
      accuracy_percentage: 60.0,
      needs_reinforcement: false,
    },
    {
      category: 'geography',
      readiness_percentage: 71,
      questions_mastered: 15,
      questions_total: 21,
      deck_ids: ['deck-geo-1'],
      accuracy_percentage: 85.0,
      needs_reinforcement: false,
    },
    {
      category: 'language',
      readiness_percentage: 24,
      questions_mastered: 2,
      questions_total: 8,
      deck_ids: [],
      accuracy_percentage: null,
      needs_reinforcement: false,
    },
    {
      category: 'society',
      readiness_percentage: 34,
      questions_mastered: 3,
      questions_total: 9,
      deck_ids: [],
      accuracy_percentage: null,
      needs_reinforcement: false,
    },
  ],
  motivation: null,
};

const DECKS_DATA = {
  total: 2,
  decks: [
    {
      id: 'exam-jul-25',
      name: "Cultural Exam Jul'25",
      description: null,
      name_en: "Cultural Exam Jul'25",
      name_ru: null,
      description_en: null,
      description_ru: null,
      category: 'culture',
      question_count: 25,
      is_premium: false,
      progress: {
        questions_total: 25,
        questions_mastered: 0,
        questions_learning: 0,
        questions_new: 25,
        last_practiced_at: null,
      },
      cover_image_url: null,
    },
    {
      id: 'exam-feb-25',
      name: "Cultural Exam Feb'25",
      description: null,
      name_en: "Cultural Exam Feb'25",
      name_ru: null,
      description_en: null,
      description_ru: null,
      category: 'culture',
      question_count: 25,
      is_premium: false,
      progress: {
        questions_total: 25,
        questions_mastered: 3,
        questions_learning: 4,
        questions_new: 18,
        last_practiced_at: '2026-06-01T10:00:00Z',
      },
      cover_image_url: null,
    },
  ],
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
      data: { total: 0, decks: [] },
      isLoading: false,
      isError: false,
      refetch: jest.fn().mockResolvedValue(undefined),
    });
    render(<CultureScreen />);
    expect(screen.queryByTestId('culture-decks-rail')).toBeNull();
  });

  it('maps verbatim backend JSON through real readiness_percentage/categories[].category fields', () => {
    // This test feeds the exact wire-format backend shape (readiness_percentage,
    // categories[].category + readiness_percentage) and asserts the screen renders
    // the expected derived output — guarding against future type drift.
    setQueries();
    render(<CultureScreen />);
    // Verdict mapped from 'getting_there' → 'Almost halfway'
    expect(screen.getByTestId('culture-verdict')).toHaveTextContent('Almost halfway');
    // Subtitle shows correct category count (5 categories in READINESS_DATA)
    expect(screen.getByTestId('culture-subtitle')).toHaveTextContent(/5 topic areas/);
    // Deck rail present with both deck cards (2 decks in DECKS_DATA)
    expect(screen.getByTestId('exam-deck-card-exam-jul-25')).toBeTruthy();
    expect(screen.getByTestId('exam-deck-card-exam-feb-25')).toBeTruthy();
  });
});
