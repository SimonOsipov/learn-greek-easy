// src/stores/__tests__/cultureSessionStore.test.ts

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  CultureAnswerResponse,
  CultureQuestionResponse,
  MultilingualText,
} from '@/types/culture';
import type { CultureSession, CultureSessionConfig } from '@/types/cultureSession';
import {
  CULTURE_SESSION_RECOVERY_VERSION,
  CULTURE_SESSION_STORAGE_KEY,
  DEFAULT_SESSION_CONFIG,
} from '@/types/cultureSession';

import { useAuthStore } from '../authStore';
import { useCultureSessionStore } from '../cultureSessionStore';

// Mock authStore (user identity drives the start guard + recovery guard)
vi.mock('../authStore');

// Mock logger to reduce noise
vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// generateSessionId pulls from analytics; keep it deterministic-ish but real is fine.

const mockUserId = 'test-user-123';

const ml = (s: string): MultilingualText => ({ el: s, en: s, ru: s });

function makeQuestion(id: string, orderIndex: number): CultureQuestionResponse {
  return {
    id,
    question_text: ml(`Question ${id}`),
    options: [ml('A'), ml('B'), ml('C'), ml('D')],
    option_count: 4,
    image_url: null,
    audio_url: null,
    audio_a2_url: null,
    order_index: orderIndex,
    correct_option: 1,
    original_article_url: null,
    also_in_decks: [],
  };
}

const mockQuestions: CultureQuestionResponse[] = [
  makeQuestion('q1', 0),
  makeQuestion('q2', 1),
  makeQuestion('q3', 2),
];

const config: CultureSessionConfig = { ...DEFAULT_SESSION_CONFIG };

function correctAnswer(xp = 10): CultureAnswerResponse {
  return { is_correct: true, correct_option: 1, xp_earned: xp, deck_category: 'history' };
}

function wrongAnswer(xp = 0): CultureAnswerResponse {
  return { is_correct: false, correct_option: 1, xp_earned: xp, deck_category: 'history' };
}

function startSession(
  result: { current: ReturnType<typeof useCultureSessionStore.getState> },
  questions: CultureQuestionResponse[] = mockQuestions
) {
  act(() => {
    result.current.startSession('deck-1', 'Deck One', 'history', questions, config);
  });
}

describe('cultureSessionStore', () => {
  beforeEach(() => {
    useCultureSessionStore.setState({
      session: null,
      summary: null,
      isLoading: false,
      error: null,
      hasRecoverableSession: false,
      currentQuestion: null,
      progress: { current: 0, total: 0 },
      hasNextQuestion: false,
    });

    vi.clearAllMocks();
    sessionStorage.clear();

    vi.mocked(useAuthStore.getState).mockReturnValue({
      user: { id: mockUserId, email: 'test@example.com', name: 'Test User' },
    } as ReturnType<typeof useAuthStore.getState>);
  });

  afterEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  describe('startSession', () => {
    it('initializes an active session with correct progress and stats', () => {
      const { result } = renderHook(() => useCultureSessionStore());

      startSession(result);

      expect(result.current.session).not.toBeNull();
      expect(result.current.session?.status).toBe('active');
      expect(result.current.session?.userId).toBe(mockUserId);
      expect(result.current.session?.questions).toHaveLength(3);
      expect(result.current.session?.questions[0].startedAt).not.toBeNull();
      expect(result.current.session?.stats.questionsRemaining).toBe(3);
      expect(result.current.progress).toEqual({ current: 1, total: 3 });
      expect(result.current.hasNextQuestion).toBe(true);
      expect(result.current.currentQuestion?.question.id).toBe('q1');
    });

    it('requires a logged-in user', () => {
      vi.mocked(useAuthStore.getState).mockReturnValue({
        user: null,
      } as ReturnType<typeof useAuthStore.getState>);

      const { result } = renderHook(() => useCultureSessionStore());
      startSession(result);

      expect(result.current.session).toBeNull();
      expect(result.current.error).toBe('You must be logged in to start a practice session');
    });

    it('rejects an empty question list', () => {
      const { result } = renderHook(() => useCultureSessionStore());
      startSession(result, []);

      expect(result.current.session).toBeNull();
      expect(result.current.error).toBe('No questions available for practice');
    });

    it('persists the session to sessionStorage', () => {
      const { result } = renderHook(() => useCultureSessionStore());
      startSession(result);

      const stored = sessionStorage.getItem(CULTURE_SESSION_STORAGE_KEY);
      expect(stored).not.toBeNull();
      const recovery = JSON.parse(stored!);
      expect(recovery.version).toBe(CULTURE_SESSION_RECOVERY_VERSION);
      expect(recovery.session.userId).toBe(mockUserId);
    });
  });

  describe('calculateUpdatedStats (via answerQuestion)', () => {
    it('rounds accuracy to the nearest integer percent', () => {
      const { result } = renderHook(() => useCultureSessionStore());
      startSession(result);

      // 1 correct out of 1 -> 100%
      act(() => {
        result.current.answerQuestion(1, correctAnswer());
      });
      expect(result.current.session?.stats.accuracy).toBe(100);

      // 1 correct out of 2 -> 50%
      act(() => {
        result.current.nextQuestion();
      });
      act(() => {
        result.current.answerQuestion(2, wrongAnswer());
      });
      expect(result.current.session?.stats.accuracy).toBe(50);

      // 2 correct out of 3 -> 66.67 rounds to 67
      act(() => {
        result.current.nextQuestion();
      });
      act(() => {
        result.current.answerQuestion(1, correctAnswer());
      });
      expect(result.current.session?.stats.correctCount).toBe(2);
      expect(result.current.session?.stats.questionsAnswered).toBe(3);
      expect(result.current.session?.stats.accuracy).toBe(67);
    });

    it('accumulates correct/incorrect counts and decrements remaining', () => {
      const { result } = renderHook(() => useCultureSessionStore());
      startSession(result);

      act(() => {
        result.current.answerQuestion(1, correctAnswer());
      });

      const stats = result.current.session!.stats;
      expect(stats.questionsAnswered).toBe(1);
      expect(stats.correctCount).toBe(1);
      expect(stats.incorrectCount).toBe(0);
      expect(stats.questionsRemaining).toBe(2);
    });

    it('sums XP earned across answers', () => {
      const { result } = renderHook(() => useCultureSessionStore());
      startSession(result);

      act(() => {
        result.current.answerQuestion(1, correctAnswer(10));
      });
      act(() => {
        result.current.nextQuestion();
      });
      act(() => {
        result.current.answerQuestion(1, correctAnswer(15));
      });

      expect(result.current.session?.stats.xpEarned).toBe(25);
    });

    it('computes the incremental average time as rounded-seconds-sum / count', () => {
      // Use fake timers so we control the per-question elapsed time precisely.
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

      const { result } = renderHook(() => useCultureSessionStore());
      startSession(result);

      // Q1 takes 2000ms -> 2s
      act(() => {
        vi.advanceTimersByTime(2000);
        result.current.answerQuestion(1, correctAnswer());
      });
      expect(result.current.session?.stats.totalTimeSeconds).toBe(2);
      expect(result.current.session?.stats.averageTimeSeconds).toBe(2);

      // Advance to next question; nextQuestion sets startedAt = now
      act(() => {
        result.current.nextQuestion();
      });

      // Q2 takes 4000ms -> 4s. total = 6s over 2 answered -> avg 3s
      act(() => {
        vi.advanceTimersByTime(4000);
        result.current.answerQuestion(2, wrongAnswer());
      });
      expect(result.current.session?.stats.totalTimeSeconds).toBe(6);
      expect(result.current.session?.stats.averageTimeSeconds).toBe(3);

      vi.useRealTimers();
    });

    it('does nothing when there is no active session', () => {
      const { result } = renderHook(() => useCultureSessionStore());
      act(() => {
        result.current.answerQuestion(1, correctAnswer());
      });
      expect(result.current.session).toBeNull();
    });
  });

  describe('nextQuestion', () => {
    it('advances index, progress and hasNextQuestion', () => {
      const { result } = renderHook(() => useCultureSessionStore());
      startSession(result);

      act(() => {
        result.current.answerQuestion(1, correctAnswer());
      });
      act(() => {
        result.current.nextQuestion();
      });

      expect(result.current.session?.currentIndex).toBe(1);
      expect(result.current.progress).toEqual({ current: 2, total: 3 });
      expect(result.current.hasNextQuestion).toBe(true);
      expect(result.current.currentQuestion?.question.id).toBe('q2');
      expect(result.current.currentQuestion?.startedAt).not.toBeNull();
    });

    it('clears hasNextQuestion on the second-to-last advance', () => {
      const { result } = renderHook(() => useCultureSessionStore());
      startSession(result);

      act(() => {
        result.current.answerQuestion(1, correctAnswer());
        result.current.nextQuestion();
      });
      act(() => {
        result.current.answerQuestion(1, correctAnswer());
        result.current.nextQuestion();
      });

      // Now on q3 (index 2), the last one
      expect(result.current.session?.currentIndex).toBe(2);
      expect(result.current.hasNextQuestion).toBe(false);
    });

    it('delegates to endSession when advancing past the last question', () => {
      const { result } = renderHook(() => useCultureSessionStore());
      startSession(result);

      // Answer all three questions
      act(() => {
        result.current.answerQuestion(1, correctAnswer());
        result.current.nextQuestion();
      });
      act(() => {
        result.current.answerQuestion(1, correctAnswer());
        result.current.nextQuestion();
      });
      act(() => {
        result.current.answerQuestion(1, correctAnswer());
      });

      // sessionStorage exists prior to final nextQuestion
      expect(sessionStorage.getItem(CULTURE_SESSION_STORAGE_KEY)).not.toBeNull();

      // nextQuestion on the last question should end the session
      act(() => {
        result.current.nextQuestion();
      });

      expect(result.current.session?.status).toBe('completed');
      expect(result.current.summary).not.toBeNull();
      expect(result.current.summary?.stats.questionsAnswered).toBe(3);
      // endSession clears recovery storage
      expect(sessionStorage.getItem(CULTURE_SESSION_STORAGE_KEY)).toBeNull();
    });

    it('does nothing when there is no active session', () => {
      const { result } = renderHook(() => useCultureSessionStore());
      act(() => {
        result.current.nextQuestion();
      });
      expect(result.current.session).toBeNull();
      expect(result.current.summary).toBeNull();
    });
  });

  describe('pause / resume', () => {
    it('pauses an active session and resumes it back to active', () => {
      const { result } = renderHook(() => useCultureSessionStore());
      startSession(result);

      act(() => {
        result.current.pauseSession();
      });
      expect(result.current.session?.status).toBe('paused');
      expect(result.current.session?.pausedAt).not.toBeNull();

      act(() => {
        result.current.resumeSession();
      });
      expect(result.current.session?.status).toBe('active');
      expect(result.current.session?.pausedAt).toBeNull();
    });
  });

  describe('endSession', () => {
    it('throws when there is no session', () => {
      const { result } = renderHook(() => useCultureSessionStore());
      expect(() => result.current.endSession()).toThrow('No session to end');
    });

    it('builds a summary containing only answered questions', () => {
      const { result } = renderHook(() => useCultureSessionStore());
      startSession(result);

      act(() => {
        result.current.answerQuestion(1, correctAnswer());
      });

      let summary;
      act(() => {
        summary = result.current.endSession();
      });

      expect(summary).toBeDefined();
      expect(result.current.summary?.questionResults).toHaveLength(1);
      expect(result.current.session?.status).toBe('completed');
    });
  });

  describe('loadFromSessionStorage (via checkRecoverableSession)', () => {
    function writeRecovery(session: CultureSession, savedAt: string, version: number) {
      sessionStorage.setItem(
        CULTURE_SESSION_STORAGE_KEY,
        JSON.stringify({ session, savedAt, version })
      );
    }

    function buildSession(overrides: Partial<CultureSession> = {}): CultureSession {
      const { result } = renderHook(() => useCultureSessionStore());
      startSession(result);
      const base = result.current.session!;
      // Reset store so storage is the only source of truth
      act(() => {
        useCultureSessionStore.setState({ session: null, hasRecoverableSession: false });
      });
      sessionStorage.clear();
      return { ...base, ...overrides };
    }

    it('detects a fresh active session as recoverable', () => {
      const session = buildSession();
      writeRecovery(session, new Date().toISOString(), CULTURE_SESSION_RECOVERY_VERSION);

      const { result } = renderHook(() => useCultureSessionStore());
      let recoverable = false;
      act(() => {
        recoverable = result.current.checkRecoverableSession();
      });

      expect(recoverable).toBe(true);
      expect(result.current.hasRecoverableSession).toBe(true);
    });

    it('discards and clears data on version mismatch', () => {
      const session = buildSession();
      writeRecovery(session, new Date().toISOString(), CULTURE_SESSION_RECOVERY_VERSION - 1);

      const { result } = renderHook(() => useCultureSessionStore());
      let recoverable = true;
      act(() => {
        recoverable = result.current.checkRecoverableSession();
      });

      expect(recoverable).toBe(false);
      expect(sessionStorage.getItem(CULTURE_SESSION_STORAGE_KEY)).toBeNull();
    });

    it('discards and clears data older than 24 hours', () => {
      const session = buildSession();
      const oldSavedAt = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
      writeRecovery(session, oldSavedAt, CULTURE_SESSION_RECOVERY_VERSION);

      const { result } = renderHook(() => useCultureSessionStore());
      let recoverable = true;
      act(() => {
        recoverable = result.current.checkRecoverableSession();
      });

      expect(recoverable).toBe(false);
      expect(sessionStorage.getItem(CULTURE_SESSION_STORAGE_KEY)).toBeNull();
    });

    it('discards and clears a completed session', () => {
      const session = buildSession({ status: 'completed' });
      writeRecovery(session, new Date().toISOString(), CULTURE_SESSION_RECOVERY_VERSION);

      const { result } = renderHook(() => useCultureSessionStore());
      let recoverable = true;
      act(() => {
        recoverable = result.current.checkRecoverableSession();
      });

      expect(recoverable).toBe(false);
      expect(sessionStorage.getItem(CULTURE_SESSION_STORAGE_KEY)).toBeNull();
    });

    it('recovers a paused session (active or paused are recoverable)', () => {
      const session = buildSession({ status: 'paused' });
      writeRecovery(session, new Date().toISOString(), CULTURE_SESSION_RECOVERY_VERSION);

      const { result } = renderHook(() => useCultureSessionStore());
      let recoverable = false;
      act(() => {
        recoverable = result.current.checkRecoverableSession();
      });

      expect(recoverable).toBe(true);
    });
  });

  describe('recoverSession (cross-user data-leak guard)', () => {
    function persistActiveSession(): CultureSession {
      const { result } = renderHook(() => useCultureSessionStore());
      startSession(result);
      const session = result.current.session!;
      act(() => {
        useCultureSessionStore.setState({
          session: null,
          summary: null,
          hasRecoverableSession: false,
          currentQuestion: null,
          progress: { current: 0, total: 0 },
          hasNextQuestion: false,
        });
      });
      return session;
    }

    it('recovers a session belonging to the current user', () => {
      const original = persistActiveSession();

      const { result } = renderHook(() => useCultureSessionStore());
      let recovered = false;
      act(() => {
        recovered = result.current.recoverSession();
      });

      expect(recovered).toBe(true);
      expect(result.current.session?.sessionId).toBe(original.sessionId);
      expect(result.current.session?.status).toBe('active');
      expect(result.current.progress).toEqual({ current: 1, total: 3 });
    });

    it('rejects recovery when the stored session belongs to a different user', () => {
      persistActiveSession();

      // Switch the logged-in user to someone else
      vi.mocked(useAuthStore.getState).mockReturnValue({
        user: { id: 'attacker-999', email: 'attacker@example.com', name: 'Attacker' },
      } as ReturnType<typeof useAuthStore.getState>);

      const { result } = renderHook(() => useCultureSessionStore());
      let recovered = true;
      act(() => {
        recovered = result.current.recoverSession();
      });

      expect(recovered).toBe(false);
      expect(result.current.session).toBeNull();
      expect(result.current.hasRecoverableSession).toBe(false);
      // The data-leak guard must scrub the stored session
      expect(sessionStorage.getItem(CULTURE_SESSION_STORAGE_KEY)).toBeNull();
    });

    it('rejects recovery when no user is logged in', () => {
      persistActiveSession();

      vi.mocked(useAuthStore.getState).mockReturnValue({
        user: null,
      } as ReturnType<typeof useAuthStore.getState>);

      const { result } = renderHook(() => useCultureSessionStore());
      let recovered = true;
      act(() => {
        recovered = result.current.recoverSession();
      });

      expect(recovered).toBe(false);
      expect(result.current.session).toBeNull();
      expect(sessionStorage.getItem(CULTURE_SESSION_STORAGE_KEY)).toBeNull();
    });

    it('returns false when there is nothing to recover', () => {
      const { result } = renderHook(() => useCultureSessionStore());
      let recovered = true;
      act(() => {
        recovered = result.current.recoverSession();
      });
      expect(recovered).toBe(false);
      expect(result.current.hasRecoverableSession).toBe(false);
    });
  });

  describe('abandon / reset / dismiss', () => {
    it('abandonSession clears state and storage', () => {
      const { result } = renderHook(() => useCultureSessionStore());
      startSession(result);

      act(() => {
        result.current.abandonSession();
      });

      expect(result.current.session).toBeNull();
      expect(result.current.progress).toEqual({ current: 0, total: 0 });
      expect(sessionStorage.getItem(CULTURE_SESSION_STORAGE_KEY)).toBeNull();
    });

    it('resetSession clears state and storage', () => {
      const { result } = renderHook(() => useCultureSessionStore());
      startSession(result);

      act(() => {
        result.current.resetSession();
      });

      expect(result.current.session).toBeNull();
      expect(sessionStorage.getItem(CULTURE_SESSION_STORAGE_KEY)).toBeNull();
    });

    it('dismissRecovery clears the flag and storage', () => {
      const { result } = renderHook(() => useCultureSessionStore());
      startSession(result);
      act(() => {
        useCultureSessionStore.setState({ session: null, hasRecoverableSession: true });
      });

      act(() => {
        result.current.dismissRecovery();
      });

      expect(result.current.hasRecoverableSession).toBe(false);
      expect(sessionStorage.getItem(CULTURE_SESSION_STORAGE_KEY)).toBeNull();
    });
  });

  describe('clearError / clearSummary', () => {
    it('clears the error message', () => {
      const { result } = renderHook(() => useCultureSessionStore());
      act(() => {
        useCultureSessionStore.setState({ error: 'boom' });
      });
      act(() => {
        result.current.clearError();
      });
      expect(result.current.error).toBeNull();
    });

    it('clears the summary', () => {
      const { result } = renderHook(() => useCultureSessionStore());
      startSession(result);
      act(() => {
        result.current.answerQuestion(1, correctAnswer());
      });
      act(() => {
        result.current.endSession();
      });
      expect(result.current.summary).not.toBeNull();

      act(() => {
        result.current.clearSummary();
      });
      expect(result.current.summary).toBeNull();
    });
  });
});
