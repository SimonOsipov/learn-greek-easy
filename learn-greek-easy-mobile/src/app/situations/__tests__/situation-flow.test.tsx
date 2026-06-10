/// <reference types="jest" />
/**
 * MOB-08 — RNTL screen tests for the Situation flow (src/app/situations/[situationId].tsx).
 *
 * Tests:
 *   1. Loading → spinner.
 *   2. Error → retry + back affordances.
 *   3. Cover step → headline, Begin CTA, back button.
 *   4. Begin → advances to retelling step.
 *   5. Retelling Continue → advances to exercise step.
 *   6. Exercise: option selection enables Check.
 *   7. Exercise: Check shows feedback banner (correct).
 *   8. Exercise: Next on last exercise advances to completion.
 *   9. Completion → heading, Back to practice.
 *  10. Back to practice → router.back().
 */
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';

// ---------------------------------------------------------------------------
// Mocks — MUST precede any import that resolves the mocked module.
// ---------------------------------------------------------------------------

jest.mock('nativewind');

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
  useLocalSearchParams: () => ({ situationId: 'court-test' }),
}));

const mockUseSituationDetail = jest.fn();
jest.mock('@/hooks/use-situation-detail', () => ({
  useSituationDetail: () => mockUseSituationDetail(),
}));

const mockUseSituationExercises = jest.fn();
const mockUseMutate = jest.fn();
jest.mock('@/hooks/use-situation-exercises', () => ({
  useSituationExercises: () => mockUseSituationExercises(),
  useReviewExercise: () => ({ mutate: mockUseMutate }),
}));

jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));

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

jest.mock('expo-audio', () => ({
  useAudioPlayer: () => ({
    play: jest.fn().mockResolvedValue(undefined),
    pause: jest.fn(),
    currentTime: 0,
  }),
}));

jest.mock('lucide-react-native', () => {
  const { View } = require('react-native');
  const ce = require('react').createElement;
  const stub = () => ce(View, { testID: 'icon-stub' });
  return {
    X: stub,
    Check: stub,
    Play: stub,
    Pause: stub,
    ArrowRight: stub,
    ChevronLeft: stub,
    Trophy: stub,
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

import SituationFlowScreen from '@/app/situations/[situationId]';
import type { SituationDetail, ExerciseQueue } from '@/types/situation';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SITUATION: SituationDetail = {
  id: 'court-test',
  scenario_el: 'Το Ανώτατο Δικαστήριο',
  scenario_en: 'Supreme Court ruling',
  scenario_ru: null,
  status: 'ready',
  description: {
    text_el: 'Το Ανώτατο Δικαστήριο απέρριψε την έφεση.',
    text_el_a2: null,
    text_en: 'The Supreme Court rejected the appeal.',
    text_en_a2: null,
    audio_url: null,
    audio_a2_url: null,
    audio_duration_seconds: null,
    audio_a2_duration_seconds: null,
    word_timestamps: null,
    word_timestamps_a2: null,
  },
  dialog: null,
  exercise_total: 1,
  exercise_completed: 0,
  source_url: null,
  source_image_url: null,
  source_title: 'cyprus-mail.com',
  picture_url: null,
  picture_variants: null,
  source_image_variants: null,
};

const EXERCISES: ExerciseQueue = {
  total_due: 1,
  total_new: 1,
  total_early_practice: 0,
  total_in_queue: 1,
  exercises: [
    {
      exercise_id: 'ex-1',
      exercise_type: 'select_correct_answer',
      modality: 'reading',
      audio_level: 'B1',
      source_type: 'description',
      status: 'new',
      is_new: true,
      items: [
        {
          item_index: 0,
          payload: {
            question_el: 'Με ποια αναλογία;',
            question_en: 'By what ratio?',
            options: [
              { text_el: '3 προς 2', is_correct: false },
              { text_el: '5 προς 3', is_correct: true },
              { text_el: '7 προς 1', is_correct: false },
            ],
          },
        },
      ],
    },
  ],
};

function setQueries({
  loading = false,
  error = false,
  exerciseLoading = false,
}: { loading?: boolean; error?: boolean; exerciseLoading?: boolean } = {}) {
  mockUseSituationDetail.mockReturnValue({
    data: loading || error ? undefined : SITUATION,
    isLoading: loading,
    isError: error,
    refetch: jest.fn().mockResolvedValue(undefined),
  });
  mockUseSituationExercises.mockReturnValue({
    data: exerciseLoading ? undefined : EXERCISES,
    isLoading: exerciseLoading,
    isError: false,
    refetch: jest.fn().mockResolvedValue(undefined),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SituationFlowScreen', () => {
  it('shows a spinner while loading', () => {
    setQueries({ loading: true });
    render(<SituationFlowScreen />);
    expect(screen.getByTestId('situation-flow-loading')).toBeTruthy();
  });

  it('shows error + retry when situation fetch fails', () => {
    setQueries({ error: true });
    render(<SituationFlowScreen />);
    expect(screen.getByTestId('situation-flow-error')).toBeTruthy();
    fireEvent.press(screen.getByTestId('situation-flow-retry'));
    expect(mockUseSituationDetail.mock.results.at(-1)?.value.refetch).toHaveBeenCalled();
  });

  it('shows back navigation on error screen', () => {
    setQueries({ error: true });
    render(<SituationFlowScreen />);
    fireEvent.press(screen.getByTestId('situation-flow-back'));
    expect(mockBack).toHaveBeenCalled();
  });

  it('renders the cover step with headline and Begin', () => {
    setQueries();
    render(<SituationFlowScreen />);
    expect(screen.getByTestId('situation-cover')).toBeTruthy();
    expect(screen.getByTestId('situation-cover-headline')).toHaveTextContent('Το Ανώτατο Δικαστήριο');
    expect(screen.getByTestId('situation-cover-begin')).toBeTruthy();
  });

  it('Begin advances to the retelling step', () => {
    setQueries();
    render(<SituationFlowScreen />);
    fireEvent.press(screen.getByTestId('situation-cover-begin'));
    expect(screen.getByTestId('situation-flow-retelling')).toBeTruthy();
    expect(screen.getByTestId('retelling-text-el')).toHaveTextContent('Το Ανώτατο Δικαστήριο απέρριψε την έφεση.');
  });

  it('Continue on retelling advances to exercise step', () => {
    setQueries();
    render(<SituationFlowScreen />);
    fireEvent.press(screen.getByTestId('situation-cover-begin'));
    fireEvent.press(screen.getByTestId('retelling-continue'));
    expect(screen.getByTestId('situation-flow-exercise')).toBeTruthy();
    expect(screen.getByTestId('exercise-question-el')).toHaveTextContent('Με ποια αναλογία;');
  });

  it('option selection enables the Check button state', () => {
    setQueries();
    render(<SituationFlowScreen />);
    fireEvent.press(screen.getByTestId('situation-cover-begin'));
    fireEvent.press(screen.getByTestId('retelling-continue'));
    // Before selection, Check is disabled (by style, not disabled prop in RNTL)
    expect(screen.getByTestId('exercise-check')).toBeTruthy();
    // Select correct option (index 1)
    fireEvent.press(screen.getByTestId('exercise-option-1'));
    // Check button is now pressable
    fireEvent.press(screen.getByTestId('exercise-check'));
    expect(screen.getByTestId('exercise-feedback-correct')).toBeTruthy();
  });

  it('correct answer shows "Got it!" feedback with Next', () => {
    setQueries();
    render(<SituationFlowScreen />);
    fireEvent.press(screen.getByTestId('situation-cover-begin'));
    fireEvent.press(screen.getByTestId('retelling-continue'));
    fireEvent.press(screen.getByTestId('exercise-option-1')); // correct
    fireEvent.press(screen.getByTestId('exercise-check'));
    expect(screen.getByTestId('exercise-feedback-correct')).toBeTruthy();
    expect(screen.getByTestId('exercise-next')).toHaveTextContent('Finish');
  });

  it('wrong answer shows "Almost" feedback', () => {
    setQueries();
    render(<SituationFlowScreen />);
    fireEvent.press(screen.getByTestId('situation-cover-begin'));
    fireEvent.press(screen.getByTestId('retelling-continue'));
    fireEvent.press(screen.getByTestId('exercise-option-0')); // wrong
    fireEvent.press(screen.getByTestId('exercise-check'));
    expect(screen.getByTestId('exercise-feedback-wrong')).toBeTruthy();
  });

  it('Finish on last exercise advances to completion', () => {
    setQueries();
    render(<SituationFlowScreen />);
    fireEvent.press(screen.getByTestId('situation-cover-begin'));
    fireEvent.press(screen.getByTestId('retelling-continue'));
    fireEvent.press(screen.getByTestId('exercise-option-1'));
    fireEvent.press(screen.getByTestId('exercise-check'));
    act(() => {
      fireEvent.press(screen.getByTestId('exercise-next'));
    });
    expect(screen.getByTestId('completion-step')).toBeTruthy();
    expect(screen.getByTestId('completion-heading')).toHaveTextContent('Situation complete');
  });

  it('Back to practice on completion calls router.back()', () => {
    setQueries();
    render(<SituationFlowScreen />);
    fireEvent.press(screen.getByTestId('situation-cover-begin'));
    fireEvent.press(screen.getByTestId('retelling-continue'));
    fireEvent.press(screen.getByTestId('exercise-option-1'));
    fireEvent.press(screen.getByTestId('exercise-check'));
    act(() => {
      fireEvent.press(screen.getByTestId('exercise-next'));
    });
    fireEvent.press(screen.getByTestId('completion-back'));
    expect(mockBack).toHaveBeenCalled();
  });
});
