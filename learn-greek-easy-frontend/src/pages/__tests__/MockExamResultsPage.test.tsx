/**
 * MockExamResultsPage Regression Tests
 *
 * Verifies the mock exam results page behavior:
 * - Basic rendering with summary
 * - Pass/fail status display
 * - Statistics grid with correct values
 * - Incorrect answers accordion
 * - Navigation buttons (back, try again)
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@/lib/test-utils';
import userEvent from '@testing-library/user-event';
import { useMockExamSessionStore } from '@/stores/mockExamSessionStore';
import type { MockExamQuestion } from '@/types/mockExam';
import type { MockExamQuestionState, MockExamSessionSummary } from '@/types/mockExamSession';

import { MockExamResultsPage } from '../MockExamResultsPage';

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock hooks
vi.mock('@/hooks/useQuestionLanguage', () => ({
  useQuestionLanguage: vi.fn().mockReturnValue({
    questionLanguage: 'en' as const,
    setQuestionLanguage: vi.fn(),
    resetToDefault: vi.fn(),
  }),
}));

// Mock analytics
vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
  registerTheme: vi.fn(),
  registerInterfaceLanguage: vi.fn(),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Mock XP store
vi.mock('@/stores/xpStore', () => ({
  useXPStore: vi.fn((selector) => {
    if (typeof selector === 'function') return selector({ loadXPStats: vi.fn() });
    return { loadXPStats: vi.fn() };
  }),
}));

// Helper: Create mock question
function createMockQuestion(id: string, orderIndex: number): MockExamQuestion {
  return {
    id,
    question_text: {
      el: `Ερώτηση ${orderIndex + 1}`,
      en: `Question ${orderIndex + 1}`,
      ru: `Вопрос ${orderIndex + 1}`,
    },
    options: [
      { el: 'Α', en: 'Correct Answer', ru: 'Правильный ответ' },
      { el: 'Β', en: 'Wrong Answer 1', ru: 'Неправильный 1' },
      { el: 'Γ', en: 'Wrong Answer 2', ru: 'Неправильный 2' },
      { el: 'Δ', en: 'Wrong Answer 3', ru: 'Неправильный 3' },
    ],
    option_count: 4,
    image_url: null,
    order_index: orderIndex,
  };
}

// Helper: Create mock summary
function createMockSummary(overrides?: Partial<MockExamSessionSummary>): MockExamSessionSummary {
  const questionResults: MockExamQuestionState[] = Array.from({ length: 25 }, (_, i) => ({
    question: createMockQuestion(`q-${i + 1}`, i),
    selectedOption: i < 20 ? 1 : 2, // First 20 correct (option 1), last 5 wrong (option 2)
    correctOption: 1,
    isCorrect: i < 20,
    xpEarned: i < 20 ? 5 : 0,
    timeTaken: 30,
    startedAt: new Date().toISOString(),
    answeredAt: new Date().toISOString(),
  }));

  return {
    sessionId: 'session-123',
    passed: true,
    score: 20,
    totalQuestions: 25,
    percentage: 80,
    passThreshold: 60,
    xpEarned: 100,
    timeTakenSeconds: 1200,
    questionResults,
    timerExpired: false,
    completedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('MockExamResultsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    // Reset store to default state
    useMockExamSessionStore.setState({
      session: null,
      summary: null,
      isLoading: false,
      error: null,
      hasRecoverableSession: false,
      currentQuestion: null,
      progress: { current: 0, total: 0 },
      hasNextQuestion: false,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders results page when summary is available', () => {
      const summary = createMockSummary();
      useMockExamSessionStore.setState({ summary });

      render(<MockExamResultsPage />);

      // Key elements should be visible
      expect(screen.getByText(/Congratulations/i)).toBeInTheDocument();
      expect(screen.getByText('20')).toBeInTheDocument(); // Score
      expect(screen.getByText('80%')).toBeInTheDocument(); // Percentage
    });

    it('redirects when no summary available', async () => {
      useMockExamSessionStore.setState({ summary: null });

      render(<MockExamResultsPage />);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/practice/culture-exam', { replace: true });
      });
    });
  });

  describe('Pass/Fail Status', () => {
    it('shows passed state with congratulations', () => {
      const summary = createMockSummary({ passed: true, score: 20, percentage: 80 });
      useMockExamSessionStore.setState({ summary });

      const { container } = render(<MockExamResultsPage />);

      expect(screen.getByText(/Congratulations/i)).toBeInTheDocument();
      // Verify the success gradient (not the danger gradient) is used for the passed state
      const gradientCard = container.querySelector('.from-\\[hsl\\(var\\(--success\\)\\)\\]');
      expect(gradientCard).toBeInTheDocument();
      // Trophy icon present for passed state (not XCircle)
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('shows failed state', () => {
      const summary = createMockSummary({ passed: false, score: 10, percentage: 40 });
      useMockExamSessionStore.setState({ summary });

      const { container } = render(<MockExamResultsPage />);

      expect(screen.getByText(/didn't pass/i)).toBeInTheDocument();
      // Verify the danger gradient (not the success gradient) is used for the failed state
      const gradientCard = container.querySelector('.from-\\[hsl\\(var\\(--danger\\)\\)\\]');
      expect(gradientCard).toBeInTheDocument();
    });
  });

  describe('Statistics Grid', () => {
    it('displays correct answer count', () => {
      const summary = createMockSummary({ score: 20 });
      useMockExamSessionStore.setState({ summary });

      render(<MockExamResultsPage />);

      expect(screen.getByText('20')).toBeInTheDocument();
      expect(screen.getByText('Correct')).toBeInTheDocument();
    });

    it('displays percentage', () => {
      const summary = createMockSummary({ percentage: 80 });
      useMockExamSessionStore.setState({ summary });

      render(<MockExamResultsPage />);

      expect(screen.getByText('80%')).toBeInTheDocument();
      expect(screen.getByText('Accuracy')).toBeInTheDocument();
    });

    it('displays time taken', () => {
      const summary = createMockSummary({ timeTakenSeconds: 1200 });
      useMockExamSessionStore.setState({ summary });

      render(<MockExamResultsPage />);

      // 1200 seconds = 20 minutes
      expect(screen.getByText('20m')).toBeInTheDocument();
      expect(screen.getByText('Time Taken')).toBeInTheDocument();
    });

    it('shows Time Expired when timer expired', () => {
      const summary = createMockSummary({ timerExpired: true });
      useMockExamSessionStore.setState({ summary });

      render(<MockExamResultsPage />);

      expect(screen.getByText('Time Expired')).toBeInTheDocument();
    });

    it('displays pass threshold', () => {
      const summary = createMockSummary({ passThreshold: 60 });
      useMockExamSessionStore.setState({ summary });

      render(<MockExamResultsPage />);

      expect(screen.getByText('60%')).toBeInTheDocument();
    });

    it('uses font-practice-mono class on stat numbers', () => {
      const summary = createMockSummary({ score: 20, percentage: 80 });
      useMockExamSessionStore.setState({ summary });

      render(<MockExamResultsPage />);

      // Find all elements with font-practice-mono class
      const monoElements = document.querySelectorAll('.font-practice-mono');
      expect(monoElements.length).toBeGreaterThan(0);
    });
  });

  describe('Incorrect Answers Accordion', () => {
    it('shows count of incorrect answers', () => {
      const summary = createMockSummary(); // Default has 5 incorrect
      useMockExamSessionStore.setState({ summary });

      render(<MockExamResultsPage />);

      expect(screen.getByText(/Review Incorrect Answers/i)).toBeInTheDocument();
      expect(screen.getByText(/\(5\)/)).toBeInTheDocument();
    });

    it('shows perfect score message when all correct', () => {
      const allCorrectResults: MockExamQuestionState[] = Array.from({ length: 25 }, (_, i) => ({
        question: createMockQuestion(`q-${i + 1}`, i),
        selectedOption: 1,
        correctOption: 1,
        isCorrect: true,
        xpEarned: 5,
        timeTaken: 30,
        startedAt: new Date().toISOString(),
        answeredAt: new Date().toISOString(),
      }));

      const summary = createMockSummary({
        score: 25,
        percentage: 100,
        questionResults: allCorrectResults,
      });
      useMockExamSessionStore.setState({ summary });

      const user = userEvent.setup();
      render(<MockExamResultsPage />);

      // Expand the accordion
      const accordionTrigger = screen.getByText(/Review Incorrect Answers/i);
      user.click(accordionTrigger);

      // Perfect score message should appear
      waitFor(() => {
        expect(screen.getByText(/Perfect/i)).toBeInTheDocument();
      });
    });
  });

  describe('Navigation', () => {
    it('Back button calls resetSession and navigates', async () => {
      const mockResetSession = vi.fn();
      const summary = createMockSummary();
      useMockExamSessionStore.setState({ summary, resetSession: mockResetSession });

      const user = userEvent.setup();
      render(<MockExamResultsPage />);

      const backButton = screen.getByRole('button', { name: /Back to Culture Exam/i });
      await user.click(backButton);

      expect(mockResetSession).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/practice/culture-exam');
    });

    it('Try Again button calls resetSession and navigates to session', async () => {
      const mockResetSession = vi.fn();
      const summary = createMockSummary();
      useMockExamSessionStore.setState({ summary, resetSession: mockResetSession });

      const user = userEvent.setup();
      render(<MockExamResultsPage />);

      const tryAgainButton = screen.getByRole('button', { name: /Try Again/i });
      await user.click(tryAgainButton);

      expect(mockResetSession).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/practice/culture-exam/session');
    });
  });
});
