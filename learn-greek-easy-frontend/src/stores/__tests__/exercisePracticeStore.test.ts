// src/stores/__tests__/exercisePracticeStore.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { exerciseAPI } from '@/services/exerciseAPI';
import type { ExerciseQueue, ExerciseQueueItem } from '@/services/exerciseAPI';
import { useAuthStore } from '@/stores/authStore';

import { useExercisePracticeStore } from '../exercisePracticeStore';

// ============================================
// Mocks
// ============================================

vi.mock('@/services/exerciseAPI', () => ({
  exerciseAPI: {
    getQueue: vi.fn(),
    submitReview: vi.fn(),
  },
}));

vi.mock('@/stores/authStore');

// ============================================
// Helpers
// ============================================

const mockExercise: ExerciseQueueItem = {
  exercise_id: 'ex-1',
  source_type: 'description' as const,
  exercise_type: 'select_correct_answer' as const,
  modality: 'listening' as const,
  audio_level: null,
  status: 'new' as const,
  is_new: true,
  is_early_practice: false,
  due_date: null,
  easiness_factor: null,
  interval: null,
  situation_id: null,
  scenario_el: null,
  scenario_en: null,
  scenario_ru: null,
  description_text_el: null,
  description_audio_url: null,
  description_audio_duration: null,
  word_timestamps: null,
  items: [
    {
      item_index: 0,
      payload: {
        prompt: { el: 'Γεια', en: 'Hello', ru: 'Привет' },
        options: [
          { el: 'A', en: 'A', ru: 'А' },
          { el: 'B', en: 'B', ru: 'Б' },
        ],
        correct_answer_index: 0,
      },
    },
  ],
};

const mockQueueResponse: ExerciseQueue = {
  total_due: 1,
  total_new: 0,
  total_early_practice: 0,
  total_in_queue: 1,
  exercises: [mockExercise],
};

const mockReviewResult = {
  exercise_id: 'ex-1',
  quality: 1,
  score: 1,
  max_score: 1,
  previous_status: 'new' as const,
  new_status: 'learning' as const,
  easiness_factor: 2.5,
  interval: 1,
  repetitions: 1,
  next_review_date: '2026-04-02',
  message: null,
};

// ============================================
// Tests
// ============================================

describe('exercisePracticeStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useExercisePracticeStore.setState({
      queue: [],
      currentIndex: 0,
      isLoading: false,
      error: null,
      answers: {},
      feedbackState: null,
      phase: 'question',
      sessionSummary: null,
      sessionId: null,
      modality: null,
      sessionStartTime: null,
      exerciseStartTime: null,
    });

    vi.mocked(useAuthStore.getState).mockReturnValue({
      user: { id: 'user-1', email: 'test@example.com' },
    } as ReturnType<typeof useAuthStore.getState>);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  // ============================================
  // Test 1: startSession loads queue and sets state
  // ============================================

  it('startSession loads queue and sets state', async () => {
    vi.mocked(exerciseAPI.getQueue).mockResolvedValue(mockQueueResponse);

    await useExercisePracticeStore.getState().startSession();

    const state = useExercisePracticeStore.getState();
    expect(state.queue).toHaveLength(1);
    expect(state.queue[0].exercise_id).toBe('ex-1');
    expect(state.currentIndex).toBe(0);
    expect(state.isLoading).toBe(false);
    expect(state.sessionId).not.toBeNull();
  });

  // ============================================
  // Test 2: submitAnswer records correct answer
  // ============================================

  it('submitAnswer records correct answer when selectedIndex matches correctIndex', () => {
    vi.mocked(exerciseAPI.submitReview).mockResolvedValue(mockReviewResult);
    useExercisePracticeStore.setState({ queue: [mockExercise], sessionId: 'session-1' });

    useExercisePracticeStore.getState().submitAnswer('ex-1', 0, 0);

    const state = useExercisePracticeStore.getState();
    expect(state.answers['ex-1']).toBeDefined();
    expect(state.answers['ex-1'].correct).toBe(true);
    expect(state.feedbackState).toEqual({
      exerciseId: 'ex-1',
      selectedIndex: 0,
      correctIndex: 0,
    });
    expect(exerciseAPI.submitReview).toHaveBeenCalledWith({
      exercise_id: 'ex-1',
      score: 1,
      max_score: 1,
    });
  });

  // ============================================
  // Test 3: submitAnswer records incorrect answer
  // ============================================

  it('submitAnswer records incorrect answer when selectedIndex does not match correctIndex', () => {
    vi.mocked(exerciseAPI.submitReview).mockResolvedValue(mockReviewResult);
    useExercisePracticeStore.setState({ queue: [mockExercise], sessionId: 'session-1' });

    useExercisePracticeStore.getState().submitAnswer('ex-1', 1, 0);

    const state = useExercisePracticeStore.getState();
    expect(state.answers['ex-1'].correct).toBe(false);
    expect(exerciseAPI.submitReview).toHaveBeenCalledWith({
      exercise_id: 'ex-1',
      score: 0,
      max_score: 1,
    });
  });

  // ============================================
  // Test 4: Explicit Continue (Check→Continue model)
  // ============================================

  it('stays in result phase after submitAnswer until advance() is called explicitly', () => {
    vi.mocked(exerciseAPI.submitReview).mockResolvedValue(mockReviewResult);
    // Two exercises so advancing doesn't end session
    const secondExercise = { ...mockExercise, exercise_id: 'ex-2' };
    useExercisePracticeStore.setState({
      queue: [mockExercise, secondExercise],
      currentIndex: 0,
      sessionId: 'session-1',
      sessionStartTime: Date.now(),
    });

    useExercisePracticeStore.getState().submitAnswer('ex-1', 0, 0);

    // Result phase: feedbackState set, index unchanged
    expect(useExercisePracticeStore.getState().feedbackState).not.toBeNull();
    expect(useExercisePracticeStore.getState().currentIndex).toBe(0);

    // Explicit Continue via advance()
    useExercisePracticeStore.getState().advance();

    const state = useExercisePracticeStore.getState();
    expect(state.feedbackState).toBeNull();
    expect(state.currentIndex).toBe(1);
  });

  // ============================================
  // Test 5: Session summary after explicit Continue on last exercise
  // ============================================

  it('sets sessionSummary after last exercise is answered and advance() is called', () => {
    vi.mocked(exerciseAPI.submitReview).mockResolvedValue(mockReviewResult);
    useExercisePracticeStore.setState({
      queue: [mockExercise],
      currentIndex: 0,
      sessionId: 'session-1',
      sessionStartTime: Date.now(),
    });

    useExercisePracticeStore.getState().submitAnswer('ex-1', 0, 0);

    // Explicit Continue (Check→Continue model)
    useExercisePracticeStore.getState().advance();

    const state = useExercisePracticeStore.getState();
    expect(state.sessionSummary).not.toBeNull();
    expect(state.sessionSummary!.total).toBe(1);
    expect(state.sessionSummary!.correct).toBe(1);
    expect(state.sessionSummary!.accuracy_pct).toBe(100);
  });

  // ============================================
  // Test 6: Fire-and-forget resilience
  // ============================================

  it('continues session even when submitReview rejects', () => {
    vi.mocked(exerciseAPI.submitReview).mockRejectedValue(new Error('Network error'));
    const secondExercise = { ...mockExercise, exercise_id: 'ex-2' };
    useExercisePracticeStore.setState({
      queue: [mockExercise, secondExercise],
      currentIndex: 0,
      sessionId: 'session-1',
      sessionStartTime: Date.now(),
    });

    // Submit answer then explicitly continue (Check→Continue model)
    useExercisePracticeStore.getState().submitAnswer('ex-1', 0, 0);
    useExercisePracticeStore.getState().advance();

    const state = useExercisePracticeStore.getState();
    expect(state.currentIndex).toBe(1);
    expect(state.error).toBeNull();
  });

  // ============================================
  // Test 7: Empty queue
  // ============================================

  it('starts session with empty queue and does not set sessionSummary', async () => {
    vi.mocked(exerciseAPI.getQueue).mockResolvedValue({
      total_due: 0,
      total_new: 0,
      total_early_practice: 0,
      total_in_queue: 0,
      exercises: [],
    });

    await useExercisePracticeStore.getState().startSession();

    const state = useExercisePracticeStore.getState();
    expect(state.queue).toHaveLength(0);
    expect(state.sessionSummary).toBeNull();
  });

  // ============================================
  // Test 8: resetSession clears all state
  // ============================================

  it('resetSession clears all state back to initial values', () => {
    useExercisePracticeStore.setState({
      queue: [mockExercise],
      currentIndex: 1,
      answers: { 'ex-1': { selectedIndex: 0, correct: true } },
      feedbackState: { exerciseId: 'ex-1', selectedIndex: 0, correctIndex: 0 },
      phase: 'result',
      sessionId: 'session-123',
      sessionSummary: { total: 1, correct: 1, accuracy_pct: 100, duration_seconds: 5 },
    });

    useExercisePracticeStore.getState().resetSession();

    const state = useExercisePracticeStore.getState();
    expect(state.queue).toHaveLength(0);
    expect(state.currentIndex).toBe(0);
    expect(state.answers).toEqual({});
    expect(state.feedbackState).toBeNull();
    expect(state.sessionId).toBeNull();
    expect(state.sessionSummary).toBeNull();
    expect(state.error).toBeNull();
  });

  // ============================================
  // RED specs: result phase (PRACT2-12-04)
  // ============================================
  // These tests define the PRACT2-12-04 contract:
  //   - submitAnswer must set phase='result' and MUST NOT auto-advance
  //   - advance() must be the only path out of the result phase
  //   - feedbackState and phase must stay in lock-step
  //   - No setTimeout timer survives a resetSession
  //
  // RED reason: the store does not yet have a `phase` field. All assertions
  // on `state.phase` will be `undefined !== 'result'`. Additionally, the
  // existing `submitAnswer` schedules a 1200ms auto-advance, so the
  // "no auto-advance" assertion (currentIndex===0 after 2000ms) will also
  // fail once phase is added and the timer is removed.

  describe('result phase (PRACT2-12-04)', () => {
    const secondExercise = { ...mockExercise, exercise_id: 'ex-2' };

    // ----------------------------------------------------------
    // Case 1: submitAnswer sets phase='result' and does NOT auto-advance
    // ----------------------------------------------------------
    it('submitAnswer sets phase=result and does not auto-advance', () => {
      vi.mocked(exerciseAPI.submitReview).mockResolvedValue(mockReviewResult);
      useExercisePracticeStore.setState({
        queue: [mockExercise, secondExercise],
        currentIndex: 0,
        sessionId: 'session-1',
        sessionStartTime: Date.now(),
      });

      useExercisePracticeStore.getState().submitAnswer('ex-1', 0, 0);

      // Advance fake timers well past the old 1200ms auto-advance window
      vi.advanceTimersByTime(2000);

      const state = useExercisePracticeStore.getState();
      // phase must be 'result' — not undefined, not 'question'
      expect((state as unknown as Record<string, unknown>).phase).toBe('result');
      // Must NOT have auto-advanced to the next question
      expect(state.currentIndex).toBe(0);
      // feedbackState must still be set
      expect(state.feedbackState).not.toBeNull();
    });

    // ----------------------------------------------------------
    // Case 2: advance() from result phase moves to next and clears phase
    // ----------------------------------------------------------
    it('advance from result moves to next and clears phase', () => {
      vi.mocked(exerciseAPI.submitReview).mockResolvedValue(mockReviewResult);
      useExercisePracticeStore.setState({
        queue: [mockExercise, secondExercise],
        currentIndex: 0,
        sessionId: 'session-1',
        sessionStartTime: Date.now(),
        answers: { 'ex-1': { selectedIndex: 0, correct: true } },
        feedbackState: { exerciseId: 'ex-1', selectedIndex: 0, correctIndex: 0 },
        // Force the store into result phase (cast because phase doesn't exist yet)
        ...({ phase: 'result' } as Record<string, unknown>),
      });

      useExercisePracticeStore.getState().advance();

      const state = useExercisePracticeStore.getState();
      expect(state.currentIndex).toBe(1);
      expect((state as unknown as Record<string, unknown>).phase).toBe('question');
      expect(state.feedbackState).toBeNull();
    });

    // ----------------------------------------------------------
    // Case 3: advance() on the last item computes sessionSummary
    // ----------------------------------------------------------
    it('advance on last item computes summary', () => {
      vi.mocked(exerciseAPI.submitReview).mockResolvedValue(mockReviewResult);
      useExercisePracticeStore.setState({
        queue: [mockExercise],
        currentIndex: 0,
        sessionId: 'session-1',
        sessionStartTime: Date.now(),
        answers: { 'ex-1': { selectedIndex: 0, correct: true } },
        feedbackState: { exerciseId: 'ex-1', selectedIndex: 0, correctIndex: 0 },
        ...({ phase: 'result' } as Record<string, unknown>),
      });

      useExercisePracticeStore.getState().advance();

      const state = useExercisePracticeStore.getState();
      // sessionSummary must be computed from answers
      expect(state.sessionSummary).not.toBeNull();
      expect(state.sessionSummary!.total).toBe(1);
      expect(state.sessionSummary!.correct).toBe(1);
      expect(state.sessionSummary!.accuracy_pct).toBe(100);
      expect(typeof state.sessionSummary!.duration_seconds).toBe('number');
    });

    // ----------------------------------------------------------
    // Case 4: submitAnswer leaves no scheduled timer
    // ----------------------------------------------------------
    it('submitAnswer leaves no scheduled timer after resetSession', () => {
      vi.mocked(exerciseAPI.submitReview).mockResolvedValue(mockReviewResult);
      useExercisePracticeStore.setState({
        queue: [mockExercise],
        currentIndex: 0,
        sessionId: 'session-1',
        sessionStartTime: Date.now(),
      });

      useExercisePracticeStore.getState().submitAnswer('ex-1', 0, 0);
      useExercisePracticeStore.getState().resetSession();

      // After resetSession there must be zero pending fake timers
      expect(vi.getTimerCount()).toBe(0);

      // State must be back to initial values
      const state = useExercisePracticeStore.getState();
      expect(state.queue).toHaveLength(0);
      expect(state.currentIndex).toBe(0);
      expect(state.answers).toEqual({});
      expect(state.feedbackState).toBeNull();
      expect(state.sessionSummary).toBeNull();
    });

    // ----------------------------------------------------------
    // Case 5: feedbackState and phase stay in lock-step
    // ----------------------------------------------------------
    it('feedbackState and phase stay in lock-step', () => {
      vi.mocked(exerciseAPI.submitReview).mockResolvedValue(mockReviewResult);
      useExercisePracticeStore.setState({
        queue: [mockExercise, secondExercise],
        currentIndex: 0,
        sessionId: 'session-1',
        sessionStartTime: Date.now(),
      });

      // After submitAnswer: both must be set
      useExercisePracticeStore.getState().submitAnswer('ex-1', 0, 0);
      {
        const state = useExercisePracticeStore.getState();
        expect(state.feedbackState).not.toBeNull();
        expect((state as unknown as Record<string, unknown>).phase).toBe('result');
      }

      // Force the result phase so advance() can be called meaningfully
      // (the phase field doesn't exist yet; this setState will be a no-op for phase)
      useExercisePracticeStore.setState({
        ...({ phase: 'result' } as Record<string, unknown>),
      });

      // After advance(): both must be cleared
      useExercisePracticeStore.getState().advance();
      {
        const state = useExercisePracticeStore.getState();
        expect(state.feedbackState).toBeNull();
        expect((state as unknown as Record<string, unknown>).phase).toBe('question');
      }
    });
  });
});
