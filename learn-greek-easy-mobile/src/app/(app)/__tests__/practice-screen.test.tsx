/// <reference types="jest" />
/**
 * MOB-08 — RNTL screen tests for the Practice index (src/app/(app)/practice.tsx).
 *
 * Tests:
 *   1. Loading → skeleton, no list.
 *   2. Error → retry affordance, refetch on press.
 *   3. Loaded → title, all cards rendered.
 *   4. Ready filter → only ready situations.
 *   5. In progress filter → only in-progress situations.
 *   6. Empty filter result → empty copy.
 *   7. Card press → router.push to /situations/{id}.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

// ---------------------------------------------------------------------------
// Mocks — MUST precede any import that resolves the mocked module.
// ---------------------------------------------------------------------------

jest.mock('nativewind');

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockUseSituations = jest.fn();
jest.mock('@/hooks/use-situations', () => ({
  useSituations: () => mockUseSituations(),
}));

jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));

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

jest.mock('lucide-react-native', () => {
  const { View } = require('react-native');
  const ce = require('react').createElement;
  const stub = (props: { testID?: string }) => ce(View, { testID: props.testID ?? 'icon-stub' });
  return { X: stub, Check: stub, Play: stub, Pause: stub, ArrowRight: stub };
});

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

import PracticeScreen from '@/app/(app)/practice';
import type { SituationItem } from '@/types/situation';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeSituation(overrides: Partial<SituationItem> = {}): SituationItem {
  return {
    id: 'sit-1',
    scenario_el: 'Το Ανώτατο Δικαστήριο',
    scenario_en: 'Supreme Court',
    status: 'ready',
    has_audio: true,
    has_dialog: false,
    exercise_total: 4,
    exercise_completed: 0,
    source_image_url: null,
    ...overrides,
  };
}

const SITUATIONS = [
  makeSituation({ id: 'court', scenario_el: 'Δικαστήριο', scenario_en: 'Court', exercise_completed: 0, exercise_total: 4 }),
  makeSituation({ id: 'marina', scenario_el: 'Μαρίνα', scenario_en: 'Marina', exercise_completed: 2, exercise_total: 4 }),
  makeSituation({ id: 'trails', scenario_el: 'Μονοπάτια', scenario_en: 'Trails', exercise_completed: 4, exercise_total: 4 }),
];

function setQueries({
  loading = false,
  error = false,
}: { loading?: boolean; error?: boolean } = {}) {
  mockUseSituations.mockReturnValue({
    data: loading || error ? undefined : { items: SITUATIONS, total: SITUATIONS.length, page: 1, page_size: 20 },
    isLoading: loading,
    isError: error,
    refetch: jest.fn().mockResolvedValue(undefined),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PracticeScreen', () => {
  it('shows the skeleton while loading', () => {
    setQueries({ loading: true });
    render(<PracticeScreen />);
    expect(screen.getByTestId('practice-loading')).toBeTruthy();
    expect(screen.queryByTestId('practice-list')).toBeNull();
  });

  it('shows error + retry when the list fails', () => {
    setQueries({ error: true });
    render(<PracticeScreen />);
    expect(screen.getByTestId('practice-error')).toBeTruthy();
    fireEvent.press(screen.getByTestId('practice-error-retry'));
    expect(mockUseSituations.mock.results.at(-1)?.value.refetch).toHaveBeenCalled();
  });

  it('renders the title and all situation cards', () => {
    setQueries();
    render(<PracticeScreen />);
    expect(screen.getByTestId('practice-title')).toHaveTextContent('Practice');
    for (const id of ['court', 'marina', 'trails']) {
      expect(screen.getByTestId(`situation-card-${id}`)).toBeTruthy();
    }
  });

  it('Ready filter shows only not-started situations', () => {
    setQueries();
    render(<PracticeScreen />);
    fireEvent.press(screen.getByTestId('situation-filter-Ready'));
    // court (0/4) → Ready; marina (2/4) → In progress; trails (4/4) → Completed
    expect(screen.getByTestId('situation-card-court')).toBeTruthy();
    expect(screen.queryByTestId('situation-card-marina')).toBeNull();
    expect(screen.queryByTestId('situation-card-trails')).toBeNull();
  });

  it('In progress filter shows only partially-done situations', () => {
    setQueries();
    render(<PracticeScreen />);
    fireEvent.press(screen.getByTestId('situation-filter-In progress'));
    expect(screen.getByTestId('situation-card-marina')).toBeTruthy();
    expect(screen.queryByTestId('situation-card-court')).toBeNull();
  });

  it('shows empty copy when no items match the filter', () => {
    mockUseSituations.mockReturnValue({
      data: { items: [], total: 0, page: 1, page_size: 20 },
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });
    render(<PracticeScreen />);
    expect(screen.getByTestId('practice-empty')).toHaveTextContent('No situations yet');
  });

  it('card press routes to the situation flow', () => {
    setQueries();
    render(<PracticeScreen />);
    fireEvent.press(screen.getByTestId('situation-card-court'));
    expect(mockPush).toHaveBeenCalledWith('/situations/court');
  });
});
