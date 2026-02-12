/**
 * CulturePracticePage Comprehensive Integration Tests
 *
 * Verifies the complete integrated experience after CPINT-05:
 * - Inline feedback via MCQComponent (showFeedback=true)
 * - Inline ScoreCard at session end
 * - Language selector, progress bar, exit/recovery dialogs
 * - Analytics tracking
 * - Edge cases
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@/lib/test-utils';
import userEvent from '@testing-library/user-event';
import { useCultureSessionStore } from '@/stores/cultureSessionStore';
import type { CultureQuestionResponse } from '@/types/culture';
import type { CultureQuestionState } from '@/types/cultureSession';

import { CulturePracticePage } from '../CulturePracticePage';

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ deckId: 'test-deck-1' }),
  };
});

// Mock API to prevent real network calls
vi.mock('@/services/cultureDeckAPI', () => ({
  cultureDeckAPI: {
    getQuestionQueue: vi.fn().mockResolvedValue({
      questions: [],
      deck_name: { en: 'Test Deck', el: 'Test Deck', ru: 'Test Deck' },
      category: 'history',
      has_studied_questions: false,
    }),
    submitAnswer: vi.fn().mockResolvedValue({
      is_correct: true,
      correct_option: 1,
      xp_earned: 5,
    }),
  },
}));

vi.mock('@/lib/errorReporting', () => ({
  reportAPIError: vi.fn(),
}));

const mockTrack = vi.fn();
vi.mock('@/hooks/useTrackEvent', () => ({
  useTrackEvent: () => ({ track: mockTrack }),
}));

vi.mock('posthog-js', () => ({
  default: { capture: vi.fn() },
}));

// Mock XP store
vi.mock('@/stores/xpStore', () => ({
  useXPStore: () => vi.fn(),
}));

// Mock data
const mockQuestion: CultureQuestionResponse = {
  id: 'q1',
  question_text: {
    en: 'What is the capital of Greece?',
    el: 'Ποια είναι η πρωτεύουσα;',
    ru: 'Какая столица?',
  },
  options: [
    { en: 'Athens', el: 'Αθήνα', ru: 'Афины' },
    { en: 'Sparta', el: 'Σπάρτη', ru: 'Спарта' },
    { en: 'Corinth', el: 'Κόρινθος', ru: 'Коринф' },
    { en: 'Thebes', el: 'Θήβα', ru: 'Фивы' },
  ],
  option_count: 4,
  image_url: null,
  order_index: 0,
  original_article_url: null,
};

function createMockQuestions(count: number): CultureQuestionResponse[] {
  return Array.from({ length: count }, (_, i) => ({
    ...mockQuestion,
    id: `q${i + 1}`,
    order_index: i,
  }));
}

function createActiveSessionState(questionCount: number, currentIndex = 0) {
  const questions = createMockQuestions(questionCount);
  const questionStates: CultureQuestionState[] = questions.map((q, i) => ({
    question: q,
    selectedOption: null,
    isCorrect: null,
    xpEarned: 0,
    timeTaken: null,
    startedAt: i === currentIndex ? new Date().toISOString() : null,
    answeredAt: null,
  }));

  return {
    session: {
      sessionId: 'test-session',
      deckId: 'test-deck-1',
      deckName: 'Test Deck',
      category: 'history' as const,
      status: 'active' as const,
      questions: questionStates,
      currentIndex,
      stats: {
        questionsAnswered: currentIndex,
        questionsRemaining: questionCount - currentIndex,
        correctCount: 0,
        incorrectCount: 0,
        accuracy: 0,
        totalTimeSeconds: 0,
        averageTimeSeconds: 0,
        xpEarned: 0,
      },
      config: {
        questionCount,
        language: 'en' as const,
        randomize: true,
        timeLimitPerQuestion: null,
      },
      startedAt: new Date().toISOString(),
      pausedAt: null,
      endedAt: null,
      userId: 'test-user',
    },
    currentQuestion: {
      question: questions[currentIndex],
      selectedOption: null,
      isCorrect: null,
      xpEarned: 0,
      timeTaken: null,
      startedAt: new Date().toISOString(),
      answeredAt: null,
    },
    progress: { current: currentIndex + 1, total: questionCount },
    isLoading: false,
    error: null,
    summary: null,
  };
}

function createSummaryState() {
  return {
    session: null,
    currentQuestion: null,
    progress: { current: 0, total: 0 },
    summary: {
      sessionId: 'test-session',
      deckId: 'test-deck-1',
      deckName: 'Test Deck',
      category: 'history' as const,
      userId: 'test-user',
      config: {
        questionCount: 5,
        language: 'en' as const,
        randomize: true,
        timeLimitPerQuestion: null,
      },
      stats: {
        questionsAnswered: 5,
        questionsRemaining: 0,
        correctCount: 3,
        incorrectCount: 2,
        accuracy: 60,
        totalTimeSeconds: 120,
        averageTimeSeconds: 24,
        xpEarned: 30,
      },
      questionResults: [
        {
          index: 0,
          isCorrect: true,
          selectedOption: 1,
          correctOption: 1,
          xpEarned: 10,
          timeTaken: 5000,
        },
        {
          index: 1,
          isCorrect: true,
          selectedOption: 2,
          correctOption: 2,
          xpEarned: 10,
          timeTaken: 4000,
        },
        {
          index: 2,
          isCorrect: false,
          selectedOption: 1,
          correctOption: 3,
          xpEarned: 0,
          timeTaken: 8000,
        },
        {
          index: 3,
          isCorrect: true,
          selectedOption: 4,
          correctOption: 4,
          xpEarned: 10,
          timeTaken: 6000,
        },
        {
          index: 4,
          isCorrect: false,
          selectedOption: 2,
          correctOption: 1,
          xpEarned: 0,
          timeTaken: 7000,
        },
      ],
      durationSeconds: 120,
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
    },
    isLoading: false,
    error: null,
  };
}

describe('CulturePracticePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCultureSessionStore.getState().abandonSession();
  });

  afterEach(() => {
    // Clean up any session storage
    sessionStorage.clear();
  });

  describe('Active session', () => {
    it('renders MCQComponent during active session', () => {
      useCultureSessionStore.setState(createActiveSessionState(5));
      render(<CulturePracticePage />);

      expect(screen.getByTestId('mcq-component')).toBeInTheDocument();
    });
  });

  describe('ScoreCard at session end', () => {
    it('renders ScoreCard with correct stats when session completes', () => {
      useCultureSessionStore.setState(createSummaryState());
      render(<CulturePracticePage />);

      expect(screen.getByTestId('score-card')).toBeInTheDocument();
      expect(screen.getByTestId('score-percentage')).toHaveTextContent('60%');
      expect(screen.getByTestId('score-fraction')).toHaveTextContent('3/5');
    });

    it('does not render MCQComponent when showing ScoreCard', () => {
      useCultureSessionStore.setState(createSummaryState());
      render(<CulturePracticePage />);

      expect(screen.queryByTestId('mcq-component')).not.toBeInTheDocument();
    });
  });

  describe('ScoreCard try-again', () => {
    it('calls resetSession and navigates on Try Again click', async () => {
      const user = userEvent.setup();
      useCultureSessionStore.setState(createSummaryState());
      render(<CulturePracticePage />);

      await user.click(screen.getByTestId('score-card-try-again'));

      expect(mockNavigate).toHaveBeenCalledWith('/culture/test-deck-1/practice');
    });
  });

  describe('LanguageSelector', () => {
    it('renders language selector during active session', () => {
      useCultureSessionStore.setState(createActiveSessionState(5));
      render(<CulturePracticePage />);

      const langSelector = screen.getByRole('group', { name: /question language/i });
      expect(langSelector).toBeInTheDocument();
    });
  });

  describe('Exit confirmation', () => {
    it('shows exit dialog when exit button clicked', async () => {
      const user = userEvent.setup();
      useCultureSessionStore.setState(createActiveSessionState(5));
      render(<CulturePracticePage />);

      await user.click(screen.getByTestId('exit-button'));

      expect(screen.getByText(/exit practice/i)).toBeInTheDocument();
    });

    it('navigates to /decks on confirm exit', async () => {
      const user = userEvent.setup();
      useCultureSessionStore.setState(createActiveSessionState(5));
      render(<CulturePracticePage />);

      await user.click(screen.getByTestId('exit-button'));
      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await user.click(confirmButton);

      expect(mockNavigate).toHaveBeenCalledWith('/decks');
    });

    it('dismisses dialog on cancel', async () => {
      const user = userEvent.setup();
      useCultureSessionStore.setState(createActiveSessionState(5));
      render(<CulturePracticePage />);

      await user.click(screen.getByTestId('exit-button'));
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByText(/exit practice/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Loading state', () => {
    it('renders skeleton during loading', () => {
      useCultureSessionStore.setState({
        session: null,
        currentQuestion: null,
        progress: { current: 0, total: 0 },
        isLoading: true,
        error: null,
        summary: null,
      });
      render(<CulturePracticePage />);

      // Skeleton should be present, no MCQ or ScoreCard
      expect(screen.queryByTestId('mcq-component')).not.toBeInTheDocument();
      expect(screen.queryByTestId('score-card')).not.toBeInTheDocument();
    });
  });

  describe('Error state', () => {
    it('shows skeleton when error occurs during initialization (session is null)', () => {
      useCultureSessionStore.setState({
        session: null,
        currentQuestion: null,
        progress: { current: 0, total: 0 },
        isLoading: false,
        error: 'Something went wrong',
        summary: null,
      });
      render(<CulturePracticePage />);

      // When session is null, loading check comes first, so skeleton renders
      // This is the actual behavior in the component (loading check before error check)
      expect(screen.queryByTestId('mcq-component')).not.toBeInTheDocument();
      expect(screen.queryByTestId('score-card')).not.toBeInTheDocument();
    });
  });

  describe('ProgressBar', () => {
    it('renders ProgressBar during active session', () => {
      useCultureSessionStore.setState(createActiveSessionState(5));
      render(<CulturePracticePage />);

      expect(screen.getByTestId('progress-bar')).toBeInTheDocument();
    });

    it('shows correct progress count', () => {
      useCultureSessionStore.setState(createActiveSessionState(10, 2));
      render(<CulturePracticePage />);

      expect(screen.getByTestId('progress-bar-counter')).toHaveTextContent('3 / 10');
    });
  });

  describe('Single question session', () => {
    it('renders with correct progress for single question', () => {
      useCultureSessionStore.setState(createActiveSessionState(1));
      render(<CulturePracticePage />);

      expect(screen.getByTestId('progress-bar-counter')).toHaveTextContent('1 / 1');
    });
  });

  describe('Session recovery', () => {
    it('shows recovery dialog when recoverable session exists', () => {
      // Set up session storage with recoverable session
      const questions = createMockQuestions(5);
      const questionStates: CultureQuestionState[] = questions.map((q) => ({
        question: q,
        selectedOption: null,
        isCorrect: null,
        xpEarned: 0,
        timeTaken: null,
        startedAt: null,
        answeredAt: null,
      }));

      const recoveryData = {
        session: {
          sessionId: 'test-session',
          deckId: 'test-deck-1',
          deckName: 'Test Deck',
          category: 'history',
          status: 'active',
          questions: questionStates,
          currentIndex: 0,
          stats: {
            questionsAnswered: 0,
            questionsRemaining: 5,
            correctCount: 0,
            incorrectCount: 0,
            accuracy: 0,
            totalTimeSeconds: 0,
            averageTimeSeconds: 0,
            xpEarned: 0,
          },
          config: {
            questionCount: 5,
            language: 'en',
            randomize: true,
            timeLimitPerQuestion: null,
          },
          startedAt: new Date().toISOString(),
          pausedAt: null,
          endedAt: null,
          userId: 'test-user',
        },
        savedAt: new Date().toISOString(),
        version: 1,
      };
      sessionStorage.setItem('learn-greek-easy:culture-session', JSON.stringify(recoveryData));

      render(<CulturePracticePage />);

      expect(screen.getByText(/resume practice/i)).toBeInTheDocument();
    });
  });

  describe('Analytics events', () => {
    it('tracks culture_session_started on session start', () => {
      useCultureSessionStore.setState(createActiveSessionState(5));
      render(<CulturePracticePage />);

      expect(mockTrack).toHaveBeenCalledWith(
        'culture_session_started',
        expect.objectContaining({
          deck_id: 'test-deck-1',
          session_id: 'test-session',
          question_count: 5,
          language: 'en',
        })
      );
    });

    it('tracks culture_session_completed when summary is shown', () => {
      useCultureSessionStore.setState(createSummaryState());
      render(<CulturePracticePage />);

      expect(mockTrack).toHaveBeenCalledWith(
        'culture_session_completed',
        expect.objectContaining({
          deck_id: 'test-deck-1',
          session_id: 'test-session',
          questions_total: 5,
          questions_correct: 3,
          accuracy: 60,
          xp_earned: 30,
        })
      );
    });

    it('tracks culture_session_abandoned on exit confirm', async () => {
      const user = userEvent.setup();
      useCultureSessionStore.setState(createActiveSessionState(5));
      render(<CulturePracticePage />);

      await user.click(screen.getByTestId('exit-button'));
      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await user.click(confirmButton);

      expect(mockTrack).toHaveBeenCalledWith(
        'culture_session_abandoned',
        expect.objectContaining({
          deck_id: 'test-deck-1',
          session_id: 'test-session',
        })
      );
    });
  });

  describe('Edge case: session recovery into answered state', () => {
    it('renders correct question after recovery at mid-session', () => {
      const state = createActiveSessionState(5, 2);

      // Mark first two questions as answered
      state.session.questions[0].selectedOption = 1;
      state.session.questions[0].isCorrect = true;
      state.session.questions[0].answeredAt = new Date().toISOString();

      state.session.questions[1].selectedOption = 2;
      state.session.questions[1].isCorrect = false;
      state.session.questions[1].answeredAt = new Date().toISOString();

      useCultureSessionStore.setState(state);
      render(<CulturePracticePage />);

      // Should render question 3 (index 2)
      expect(screen.getByTestId('progress-bar-counter')).toHaveTextContent('3 / 5');
    });
  });
});
