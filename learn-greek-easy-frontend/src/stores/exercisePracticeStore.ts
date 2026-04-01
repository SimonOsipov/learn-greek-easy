import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import { exerciseAPI } from '@/services/exerciseAPI';
import type { ExerciseModality, ExerciseQueueItem } from '@/services/exerciseAPI';
import { useAuthStore } from '@/stores/authStore';
import { generateSessionId } from '@/utils/analytics';

interface ExerciseSessionSummary {
  total: number;
  correct: number;
  accuracy_pct: number;
  duration_seconds: number;
}

interface ExercisePracticeState {
  // Queue data
  queue: ExerciseQueueItem[];
  currentIndex: number;
  isLoading: boolean;
  error: string | null;

  // Answer tracking — keyed by exercise_id
  answers: Record<string, { selectedIndex: number; correct: boolean }>;

  // Feedback pause state
  feedbackState: {
    exerciseId: string;
    selectedIndex: number;
    correctIndex: number;
  } | null;

  // Session metadata
  sessionSummary: ExerciseSessionSummary | null;
  sessionId: string | null;
  modality: ExerciseModality | null;
  sessionStartTime: number | null;
  exerciseStartTime: number | null;

  // Internal timer
  _feedbackTimer: ReturnType<typeof setTimeout> | null;

  // Actions
  startSession: (modality?: ExerciseModality) => Promise<void>;
  submitAnswer: (exerciseId: string, selectedIndex: number, correctIndex: number) => void;
  advance: () => void;
  endSession: () => void;
  resetSession: () => void;
  clearError: () => void;
  clearSessionSummary: () => void;
}

const initialState = {
  queue: [] as ExerciseQueueItem[],
  currentIndex: 0,
  isLoading: false,
  error: null,
  answers: {} as Record<string, { selectedIndex: number; correct: boolean }>,
  feedbackState: null,
  sessionSummary: null,
  sessionId: null,
  modality: null as ExerciseModality | null,
  sessionStartTime: null,
  exerciseStartTime: null,
  _feedbackTimer: null,
};

export const useExercisePracticeStore = create<ExercisePracticeState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      startSession: async (modality?: ExerciseModality) => {
        const existingTimer = get()._feedbackTimer;
        if (existingTimer) {
          clearTimeout(existingTimer);
        }
        set({ isLoading: true, error: null });
        try {
          const { user } = useAuthStore.getState();
          if (!user) {
            throw new Error('User not logged in');
          }
          const response = await exerciseAPI.getQueue({ modality });
          const now = Date.now();
          set({
            queue: response.exercises,
            currentIndex: 0,
            isLoading: false,
            error: null,
            answers: {},
            feedbackState: null,
            sessionSummary: null,
            sessionId: generateSessionId(),
            modality: modality ?? null,
            sessionStartTime: now,
            exerciseStartTime: now,
            _feedbackTimer: null,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to load exercises';
          set({ isLoading: false, error: message });
          throw err;
        }
      },

      submitAnswer: (exerciseId: string, selectedIndex: number, correctIndex: number) => {
        const state = get();
        // Clear any existing timer (defensive: prevent double-advance)
        if (state._feedbackTimer) {
          clearTimeout(state._feedbackTimer);
        }
        const correct = selectedIndex === correctIndex;
        const updatedAnswers = {
          ...state.answers,
          [exerciseId]: { selectedIndex, correct },
        };
        set({
          answers: updatedAnswers,
          feedbackState: { exerciseId, selectedIndex, correctIndex },
        });
        // Fire-and-forget review submission
        exerciseAPI
          .submitReview({
            exercise_id: exerciseId,
            score: correct ? 1 : 0,
            max_score: 1,
          })
          .catch(() => {
            // Fire-and-forget: silently ignore. Session continues.
          });
        // Schedule auto-advance after 1.2s feedback pause
        const timer = setTimeout(() => {
          get().advance();
        }, 1200);
        set({ _feedbackTimer: timer });
      },

      advance: () => {
        const state = get();
        // Clear timer to prevent double-advance
        if (state._feedbackTimer) {
          clearTimeout(state._feedbackTimer);
        }
        set({ feedbackState: null, exerciseStartTime: Date.now(), _feedbackTimer: null });
        const nextIndex = state.currentIndex + 1;
        if (nextIndex >= state.queue.length) {
          // Session complete — compute summary
          const total = Object.keys(state.answers).length;
          const correct = Object.values(state.answers).filter((a) => a.correct).length;
          const duration_seconds = state.sessionStartTime
            ? Math.round((Date.now() - state.sessionStartTime) / 1000)
            : 0;
          const accuracy_pct = total > 0 ? Math.round((correct / total) * 100) : 0;
          set({
            currentIndex: nextIndex,
            sessionSummary: { total, correct, accuracy_pct, duration_seconds },
          });
        } else {
          set({ currentIndex: nextIndex });
        }
      },

      endSession: () => {
        const { _feedbackTimer } = get();
        if (_feedbackTimer) {
          clearTimeout(_feedbackTimer);
        }
        set({ ...initialState });
      },

      resetSession: () => {
        const { _feedbackTimer } = get();
        if (_feedbackTimer) {
          clearTimeout(_feedbackTimer);
        }
        set({ ...initialState });
      },

      clearError: () => set({ error: null }),

      clearSessionSummary: () => set({ sessionSummary: null }),
    }),
    { name: 'exercisePracticeStore' }
  )
);
