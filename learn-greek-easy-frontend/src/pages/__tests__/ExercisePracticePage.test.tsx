/**
 * ExercisePracticePage Tests
 *
 * Covers:
 * - modality param "listening" maps to ExerciseModality; absent/unknown maps to undefined
 * - keyboard handler resolves correct_answer_index payload shape
 * - keyboard handler resolves correct_index payload shape
 * - keyboard handler is a no-op when correctAnswerIndex resolves to -1
 * - exit button shows no dialog when there are no answers
 * - exit button shows dialog when answers exist and session is not complete
 * - confirm exit navigates away; stay dismisses dialog
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { queryKeys } from '@/lib/queryKeys';
import { render, screen, waitFor, act } from '@/lib/test-utils';
import userEvent from '@testing-library/user-event';

import { ExercisePracticePage } from '../ExercisePracticePage';

// ============================================
// Mocks
// ============================================

const mockNavigate = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [mockSearchParams, vi.fn()],
  };
});

// PERF-22-03: exercise-session finish must invalidate queryKeys.exerciseQueue(userId)
// (mirrors the PERF-22-02 flashcard-finish invalidation pattern in
// V2FlashcardPracticePage.tsx). A single stable object — NOT a fresh literal
// per call — since the real useQueryClient() returns the same client
// instance via context on every render (see PERF-22-02 QA note in
// V2FlashcardPracticePage.test.tsx: a per-call mock gives `queryClient` a new
// identity every render, masking a spurious-refetch regression in a
// [sessionSummary, queryClient, userId]-keyed effect).
const mockInvalidateQueries = vi.fn();
const mockQueryClient = { invalidateQueries: mockInvalidateQueries };

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQueryClient: () => mockQueryClient,
  };
});

// PERF-22-03 / Decision 11: mock a real, non-undefined user id (pattern per
// Dashboard.test.tsx:51-60) so the invalidation assertion below proves the
// per-user key is used, not queryKeys.exerciseQueue(undefined).
const mockAuthState = {
  user: { id: 'u1', name: 'Test User', email: 'test@test.com' },
  isAuthenticated: true,
};

vi.mock('@/stores/authStore', () => ({
  useAuthStore: vi.fn((selector?: (s: Record<string, unknown>) => unknown) =>
    selector ? selector(mockAuthState) : mockAuthState
  ),
}));

vi.mock('posthog-js', () => ({
  default: { capture: vi.fn() },
}));

// Analytics track — keep silent
vi.mock('@/lib/analytics/track', () => ({
  track: vi.fn(),
  __setPosthogInstance: vi.fn(),
  getPosthogInstance: vi.fn(() => null),
}));

// usePracticeSession — return a resetTracking stub (not the subject under test here)
vi.mock('@/hooks/usePracticeSession', () => ({
  usePracticeSession: vi.fn(() => ({ resetTracking: vi.fn() })),
}));

// useStudyStreak — stub (PRACT2-12-05 added this import; the page test doesn't need real data)
vi.mock('@/hooks/useStudyStreak', () => ({
  useStudyStreak: vi.fn(() => ({
    streak: { currentStreak: 0, longestStreak: 0 },
    loading: false,
    error: null,
  })),
}));

// usePracticeKeyboard — capture the passed keymap so tests can invoke handlers directly
let capturedKeymap: Record<string, () => void> = {};
vi.mock('@/hooks/usePracticeKeyboard', () => ({
  usePracticeKeyboard: vi.fn(({ keymap }: { keymap: Record<string, () => void> }) => {
    capturedKeymap = keymap;
  }),
}));

// Child renderers — lightweight stubs so we don't need their full dependency tree
vi.mock('@/components/exercises/ExerciseContentStep', () => ({
  ExerciseContentStep: () => <div data-testid="exercise-content-step" />,
}));

vi.mock('@/components/exercises/SelectCorrectAnswerRenderer', () => ({
  SelectCorrectAnswerRenderer: () => <div data-testid="select-correct-answer-renderer" />,
}));

vi.mock('@/components/exercises/SelectPictureFromDescriptionCard', () => ({
  SelectPictureFromDescriptionCard: () => (
    <div data-testid="select-picture-from-description-card" />
  ),
}));

vi.mock('@/components/exercises/SelectDescriptionFromPictureCard', () => ({
  SelectDescriptionFromPictureCard: () => (
    <div data-testid="select-description-from-picture-card" />
  ),
}));

// ============================================
// Store mock setup
// ============================================

const mockStartSession = vi.fn().mockResolvedValue(undefined);
const mockSubmitAnswer = vi.fn();
const mockAdvance = vi.fn();
const mockResetSession = vi.fn();
const mockClearError = vi.fn();

const defaultStoreState = {
  queue: [] as ReturnType<typeof makeExercise>[],
  currentIndex: 0,
  isLoading: false,
  error: null,
  feedbackState: null as { exerciseId: string; selectedIndex: number; correctIndex: number } | null,
  phase: 'question' as 'question' | 'result',
  sessionSummary: null as {
    total: number;
    correct: number;
    accuracy_pct: number;
    duration_seconds: number;
  } | null,
  answers: {} as Record<string, { selectedIndex: number; correct: boolean }>,
  exerciseStartTime: null as number | null,
  sessionStartTime: null as number | null,
  startSession: mockStartSession,
  submitAnswer: mockSubmitAnswer,
  advance: mockAdvance,
  resetSession: mockResetSession,
  clearError: mockClearError,
};

let mockStoreState = { ...defaultStoreState };

vi.mock('@/stores/exercisePracticeStore', () => ({
  useExercisePracticeStore: () => mockStoreState,
}));

vi.mock('@/stores/questionLanguageStore', () => ({
  useQuestionLanguageStore: () => ({ language: 'en', setLanguage: vi.fn() }),
}));

// ============================================
// Helpers
// ============================================

/** Build a minimal ExerciseQueueItem with a custom payload on items[0] */
function makeExercise(payload: Record<string, unknown>) {
  return {
    exercise_id: 'ex-1',
    source_type: 'description' as const,
    exercise_type: 'select_correct_answer' as const,
    modality: null as null,
    audio_level: null as null,
    status: 'new' as const,
    is_new: true,
    is_early_practice: false,
    due_date: null as null,
    easiness_factor: null as null,
    interval: null as null,
    situation_id: null as null,
    scenario_el: null as null,
    scenario_en: null as null,
    scenario_ru: null as null,
    description_text_el: null as null,
    description_audio_url: null as null,
    description_audio_duration: null as null,
    word_timestamps: null as null,
    items: [{ item_index: 0, payload }],
  };
}

/** Render the page and wait for startSession to be called */
async function renderPage() {
  render(<ExercisePracticePage />);
  await waitFor(() => expect(mockStartSession).toHaveBeenCalled());
}

// ============================================
// Tests
// ============================================

describe('ExercisePracticePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedKeymap = {};
    mockStartSession.mockResolvedValue(undefined);
    mockSearchParams = new URLSearchParams();
    mockStoreState = { ...defaultStoreState };
  });

  // ------------------------------------------
  // Modality param parsing
  // ------------------------------------------

  describe('modality param parsing', () => {
    it('passes "listening" modality to startSession when ?modality=listening', async () => {
      mockSearchParams = new URLSearchParams('modality=listening');
      await renderPage();
      expect(mockStartSession).toHaveBeenCalledWith('listening');
    });

    it('passes "reading" modality to startSession when ?modality=reading', async () => {
      mockSearchParams = new URLSearchParams('modality=reading');
      await renderPage();
      expect(mockStartSession).toHaveBeenCalledWith('reading');
    });

    it('passes undefined to startSession when modality param is absent', async () => {
      mockSearchParams = new URLSearchParams();
      await renderPage();
      expect(mockStartSession).toHaveBeenCalledWith(undefined);
    });

    it('passes undefined to startSession when modality param is "all" (unknown value)', async () => {
      mockSearchParams = new URLSearchParams('modality=all');
      await renderPage();
      expect(mockStartSession).toHaveBeenCalledWith(undefined);
    });
  });

  // ------------------------------------------
  // Keyboard handler — payload shape resolution
  // ------------------------------------------

  describe('keyboard handler', () => {
    it('resolves correctAnswerIndex from correct_answer_index payload shape and calls submitAnswer', async () => {
      const exercise = makeExercise({
        correct_answer_index: 2,
        options: ['a', 'b', 'c'],
      });
      mockStoreState = {
        ...defaultStoreState,
        queue: [exercise],
        currentIndex: 0,
        feedbackState: null,
        exerciseStartTime: Date.now(),
      };

      await renderPage();

      // Trigger keyboard "3" → option index 2
      capturedKeymap['3']();

      expect(mockSubmitAnswer).toHaveBeenCalledWith('ex-1', 2, 2);
    });

    it('resolves correctAnswerIndex from correct_index payload shape and calls submitAnswer', async () => {
      const exercise = makeExercise({
        correct_index: 1,
        options: ['a', 'b'],
      });
      mockStoreState = {
        ...defaultStoreState,
        queue: [exercise],
        currentIndex: 0,
        feedbackState: null,
        exerciseStartTime: Date.now(),
      };

      await renderPage();

      // Trigger keyboard "1" → option index 0
      capturedKeymap['1']();

      expect(mockSubmitAnswer).toHaveBeenCalledWith('ex-1', 0, 1);
    });

    it('is a no-op when correctAnswerIndex resolves to -1 (no payload key)', async () => {
      const exercise = makeExercise({
        // neither correct_answer_index nor correct_index present
        options: ['a', 'b'],
      });
      mockStoreState = {
        ...defaultStoreState,
        queue: [exercise],
        currentIndex: 0,
        feedbackState: null,
        exerciseStartTime: Date.now(),
      };

      await renderPage();

      capturedKeymap['1']();

      expect(mockSubmitAnswer).not.toHaveBeenCalled();
    });

    it('is a no-op when optionIndex is out of range', async () => {
      const exercise = makeExercise({
        correct_answer_index: 0,
        options: ['a'], // only 1 option, so index 1 is out-of-range
      });
      mockStoreState = {
        ...defaultStoreState,
        queue: [exercise],
        currentIndex: 0,
        feedbackState: null,
        exerciseStartTime: Date.now(),
      };

      await renderPage();

      // "2" maps to optionIndex 1, which is >= options.length (1)
      capturedKeymap['2']();

      expect(mockSubmitAnswer).not.toHaveBeenCalled();
    });

    it('is a no-op when feedbackState is non-null (answer already submitted)', async () => {
      const exercise = makeExercise({
        correct_answer_index: 0,
        options: ['a', 'b'],
      });
      mockStoreState = {
        ...defaultStoreState,
        queue: [exercise],
        currentIndex: 0,
        feedbackState: { exerciseId: 'ex-1', selectedIndex: 0, correctIndex: 0 },
        exerciseStartTime: Date.now(),
      };

      await renderPage();

      capturedKeymap['1']();

      expect(mockSubmitAnswer).not.toHaveBeenCalled();
    });
  });

  // ------------------------------------------
  // Exit logic
  // ------------------------------------------

  describe('exit button behavior', () => {
    it('navigates immediately when answers is empty (no dialog)', async () => {
      // queue has one exercise so the active session UI renders (with the header exit button)
      const exercise = makeExercise({ correct_answer_index: 0, options: ['a'] });
      mockStoreState = {
        ...defaultStoreState,
        queue: [exercise],
        currentIndex: 0,
        answers: {},
        sessionSummary: null,
      };

      const user = userEvent.setup();
      await renderPage();

      const exitButton = screen.getByTestId('exercise-practice-close-button');
      await user.click(exitButton);

      // Should navigate without showing a dialog
      expect(mockNavigate).toHaveBeenCalledWith('/practice/exercises');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('shows exit dialog when answers exist and session is not complete', async () => {
      const exercise = makeExercise({ correct_answer_index: 0, options: ['a'] });
      mockStoreState = {
        ...defaultStoreState,
        queue: [exercise],
        currentIndex: 0,
        answers: { 'ex-1': { selectedIndex: 0, correct: true } },
        sessionSummary: null,
      };

      const user = userEvent.setup();
      await renderPage();

      const exitButton = screen.getByTestId('exercise-practice-close-button');
      await user.click(exitButton);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });

    it('navigates away on confirming exit dialog', async () => {
      const exercise = makeExercise({ correct_answer_index: 0, options: ['a'] });
      mockStoreState = {
        ...defaultStoreState,
        queue: [exercise],
        currentIndex: 0,
        answers: { 'ex-1': { selectedIndex: 0, correct: true } },
        sessionSummary: null,
      };

      const user = userEvent.setup();
      await renderPage();

      // Open dialog
      const exitButton = screen.getByTestId('exercise-practice-close-button');
      await user.click(exitButton);

      await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

      // The leave/confirm action button
      const leaveButton = screen.getByRole('button', { name: /leave/i });
      await user.click(leaveButton);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/practice/exercises');
      });
    });

    it('dismisses exit dialog without navigating on "stay" button click', async () => {
      const exercise = makeExercise({ correct_answer_index: 0, options: ['a'] });
      mockStoreState = {
        ...defaultStoreState,
        queue: [exercise],
        currentIndex: 0,
        answers: { 'ex-1': { selectedIndex: 0, correct: true } },
        sessionSummary: null,
      };

      const user = userEvent.setup();
      await renderPage();

      // Open dialog
      const exitButton = screen.getByTestId('exercise-practice-close-button');
      await user.click(exitButton);

      await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

      // Click the "Stay" button
      const stayButton = screen.getByRole('button', { name: /stay/i });
      await user.click(stayButton);

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  // ------------------------------------------
  // PERF-22-03: exercise-session finish invalidates queryKeys.exerciseQueue(userId)
  // ------------------------------------------
  //
  // RED reason: ExercisePracticePage.tsx has no invalidation effect at all
  // today, so mockInvalidateQueries is never called and the final assertion
  // fails (toHaveBeenCalledWith on a mock with zero calls) — a genuine
  // assertion failure, not a collection/import error.
  describe('session-finish invalidation (PERF-22-03)', () => {
    it("invalidates queryKeys.exerciseQueue('u1') when sessionSummary transitions from null to populated", async () => {
      mockStoreState = { ...defaultStoreState, sessionSummary: null };
      const { rerender } = render(<ExercisePracticePage />);
      await waitFor(() => expect(mockStartSession).toHaveBeenCalled());

      expect(mockInvalidateQueries).not.toHaveBeenCalled();

      await act(async () => {
        mockStoreState = {
          ...mockStoreState,
          sessionSummary: { total: 5, correct: 4, accuracy_pct: 80, duration_seconds: 120 },
        };
        rerender(<ExercisePracticePage />);
      });

      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: queryKeys.exerciseQueue('u1'),
      });
    });

    // QA adversarial (PERF-22-03 Mode B): the finish effect must NOT fire on
    // mount, and must NOT fire on unrelated re-renders while sessionSummary
    // stays null (e.g. answers accumulating mid-session) — only a genuine
    // null -> populated transition should invalidate. Guards against an
    // effect with an over-broad condition (e.g. missing the `if (sessionSummary)`
    // guard, or keying off `answers`/`currentIndex` instead of `sessionSummary`).
    it('does NOT invalidate on mount, nor on unrelated re-renders while sessionSummary stays null', async () => {
      mockStoreState = { ...defaultStoreState, sessionSummary: null };
      const { rerender } = render(<ExercisePracticePage />);
      await waitFor(() => expect(mockStartSession).toHaveBeenCalled());

      expect(mockInvalidateQueries).not.toHaveBeenCalled();

      // Mid-session re-render: answers/currentIndex change, sessionSummary stays null.
      await act(async () => {
        mockStoreState = {
          ...mockStoreState,
          currentIndex: 1,
          answers: { 'ex-1': { selectedIndex: 0, correct: true } },
        };
        rerender(<ExercisePracticePage />);
      });

      expect(mockInvalidateQueries).not.toHaveBeenCalled();
    });
  });
});
