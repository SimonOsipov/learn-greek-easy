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
    seekTo: jest.fn(),
    currentTime: 0,
  }),
  useAudioPlayerStatus: () => ({
    playing: false,
    didJustFinish: false,
    currentTime: 0,
    duration: 0,
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

// Fixture uses verbatim backend LearnerSituationDetailResponse shape.
// NOTE: text_en / text_en_a2 do NOT exist in LearnerDescriptionNested (#8/#18).
const SITUATION: SituationDetail = {
  id: 'court-test',
  scenario_el: 'Το Ανώτατο Δικαστήριο',
  scenario_en: 'Supreme Court ruling',
  scenario_ru: null,
  status: 'ready',
  description: {
    text_el: 'Το Ανώτατο Δικαστήριο απέρριψε την έφεση.',
    text_el_a2: null,
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

// Fixture uses verbatim backend SelectCorrectAnswerPayload shape (exercise_payload.py:84-89):
// prompt:{el,en,ru}, options:[{el,en,ru}], correct_answer_index.
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
            prompt: { el: 'Με ποια αναλογία;', en: 'By what ratio?', ru: 'В каком соотношении?' },
            options: [
              { el: '3 προς 2', en: '3 to 2', ru: '3 к 2' },
              { el: '5 προς 3', en: '5 to 3', ru: '5 к 3' },
              { el: '7 προς 1', en: '7 to 1', ru: '7 к 1' },
            ],
            correct_answer_index: 1,
          },
        },
      ],
    },
  ],
};

// Two-exercise queue for state-leak test (#38)
const EXERCISES_TWO: ExerciseQueue = {
  total_due: 2,
  total_new: 2,
  total_early_practice: 0,
  total_in_queue: 2,
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
            prompt: { el: 'Ερώτηση πρώτη;', en: 'First question?', ru: 'Первый вопрос?' },
            options: [
              { el: 'Απάντηση Α', en: 'Answer A', ru: 'Ответ A' },
              { el: 'Απάντηση Β', en: 'Answer B', ru: 'Ответ B' },
            ],
            correct_answer_index: 0,
          },
        },
      ],
    },
    {
      exercise_id: 'ex-2',
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
            prompt: { el: 'Ερώτηση δεύτερη;', en: 'Second question?', ru: 'Второй вопрос?' },
            options: [
              { el: 'Επιλογή Χ', en: 'Choice X', ru: 'Выбор X' },
              { el: 'Επιλογή Ψ', en: 'Choice Y', ru: 'Выбор Y' },
            ],
            correct_answer_index: 1,
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

  // #38: second exercise must mount unchecked with no feedback banner (key prop reset)
  it('second exercise mounts unchecked with no feedback banner', () => {
    mockUseSituationDetail.mockReturnValue({
      data: { ...SITUATION, exercise_total: 2 },
      isLoading: false,
      isError: false,
      refetch: jest.fn().mockResolvedValue(undefined),
    });
    mockUseSituationExercises.mockReturnValue({
      data: EXERCISES_TWO,
      isLoading: false,
      isError: false,
      refetch: jest.fn().mockResolvedValue(undefined),
    });

    render(<SituationFlowScreen />);
    fireEvent.press(screen.getByTestId('situation-cover-begin'));
    fireEvent.press(screen.getByTestId('retelling-continue'));

    // Answer first exercise
    fireEvent.press(screen.getByTestId('exercise-option-0')); // correct (index 0)
    fireEvent.press(screen.getByTestId('exercise-check'));
    act(() => {
      fireEvent.press(screen.getByTestId('exercise-next'));
    });

    // Second exercise should be unchecked — no feedback banner
    expect(screen.queryByTestId('exercise-feedback-correct')).toBeNull();
    expect(screen.queryByTestId('exercise-feedback-wrong')).toBeNull();
    // Check button should be present (no option selected yet)
    expect(screen.getByTestId('exercise-check')).toBeTruthy();
  });

  // #7/#39: resume — exercise_completed=2/exercise_total=4 should open on the third exercise
  it('resumes at the correct exercise step when exercise_completed > 0', async () => {
    const resumeSituation = {
      ...SITUATION,
      exercise_total: 4,
      exercise_completed: 2,
    };
    // Build a 4-exercise queue; the flow should skip to index 2 (third exercise)
    const ex = (id: string, q: string): typeof EXERCISES_TWO['exercises'][0] => ({
      exercise_id: id,
      exercise_type: 'select_correct_answer' as const,
      modality: 'reading' as const,
      audio_level: 'B1' as const,
      source_type: 'description' as const,
      status: 'new' as const,
      is_new: true,
      items: [{
        item_index: 0,
        payload: {
          prompt: { el: q, en: q, ru: q },
          options: [
            { el: 'Α', en: 'A', ru: 'A' },
            { el: 'Β', en: 'B', ru: 'B' },
          ],
          correct_answer_index: 0,
        },
      }],
    });
    const fourExercises: ExerciseQueue = {
      total_due: 4,
      total_new: 4,
      total_early_practice: 0,
      total_in_queue: 4,
      exercises: [
        ex('ex-r1', 'Ερώτηση 1;'),
        ex('ex-r2', 'Ερώτηση 2;'),
        ex('ex-r3', 'Ερώτηση 3;'),
        ex('ex-r4', 'Ερώτηση 4;'),
      ],
    };
    mockUseSituationDetail.mockReturnValue({
      data: resumeSituation,
      isLoading: false,
      isError: false,
      refetch: jest.fn().mockResolvedValue(undefined),
    });
    mockUseSituationExercises.mockReturnValue({
      data: fourExercises,
      isLoading: false,
      isError: false,
      refetch: jest.fn().mockResolvedValue(undefined),
    });

    render(<SituationFlowScreen />);

    // After both queries resolve, the init effect runs (within act)
    await act(async () => {});

    // Should have jumped past cover + retellings (0) + 2 completed exercises → exercise index 2
    // so step-header should be visible and the third exercise question should show
    expect(screen.getByTestId('situation-flow-exercise')).toBeTruthy();
    expect(screen.getByTestId('exercise-question-el')).toHaveTextContent('Ερώτηση 3;');
  });

  // #40: review mutation payload assertion — correct answer → score:1, wrong answer → score:0
  it('correct answer submits review mutation with score:1', () => {
    setQueries();
    render(<SituationFlowScreen />);
    fireEvent.press(screen.getByTestId('situation-cover-begin'));
    fireEvent.press(screen.getByTestId('retelling-continue'));
    fireEvent.press(screen.getByTestId('exercise-option-1')); // correct (correct_answer_index=1)
    fireEvent.press(screen.getByTestId('exercise-check'));
    act(() => {
      fireEvent.press(screen.getByTestId('exercise-next'));
    });
    expect(mockUseMutate).toHaveBeenCalledWith({
      exercise_id: 'ex-1',
      score: 1,
      max_score: 1,
    });
  });

  it('wrong answer submits review mutation with score:0 on Finish', () => {
    setQueries();
    render(<SituationFlowScreen />);
    fireEvent.press(screen.getByTestId('situation-cover-begin'));
    fireEvent.press(screen.getByTestId('retelling-continue'));
    fireEvent.press(screen.getByTestId('exercise-option-0')); // wrong (correct is index 1)
    fireEvent.press(screen.getByTestId('exercise-check'));
    act(() => {
      fireEvent.press(screen.getByTestId('exercise-next'));
    });
    expect(mockUseMutate).toHaveBeenCalledWith({
      exercise_id: 'ex-1',
      score: 0,
      max_score: 1,
    });
  });
});
