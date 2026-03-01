/**
 * QuestionBrowser Component Tests
 *
 * Tests for the QuestionBrowser component, covering:
 * - Loading state (6 skeletons)
 * - Question grid rendering
 * - Search (case-insensitive, 300ms debounce)
 * - Filter pills (counts, disabled at 0 except All)
 * - Empty deck state
 * - Empty search/filter state with clear action
 * - Error state with retry button
 * - Counter text
 */

import React from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import i18n from '@/i18n';
import { renderWithProviders } from '@/lib/test-utils';
import { cultureDeckAPI } from '@/services/cultureDeckAPI';
import type { CultureQuestionBrowseResponse } from '@/types/culture';

import { QuestionBrowser } from '../QuestionBrowser';

// ============================================
// Mocks
// ============================================

vi.mock('@/services/cultureDeckAPI', () => ({
  cultureDeckAPI: {
    browseQuestions: vi.fn(),
  },
}));

// ============================================
// Test helpers
// ============================================

const makeBrowseResponse = (
  questions: CultureQuestionBrowseResponse['questions'] = []
): CultureQuestionBrowseResponse => ({
  deck_id: 'deck-1',
  deck_name: 'Test Deck',
  total: questions.length,
  offset: 0,
  limit: 200,
  questions,
});

const mockQuestions: CultureQuestionBrowseResponse['questions'] = [
  {
    id: 'q-1',
    question_text: { el: 'Ελλάδα ερώτηση', en: 'Greece question one', ru: 'Вопрос Греция один' },
    option_count: 4,
    order_index: 0,
    status: 'new',
  },
  {
    id: 'q-2',
    question_text: { el: 'Κύπρος ερώτηση', en: 'Cyprus question two', ru: 'Вопрос Кипр два' },
    option_count: 3,
    order_index: 1,
    status: 'learning',
  },
  {
    id: 'q-3',
    question_text: {
      el: 'Ιστορία ερώτηση',
      en: 'History question three',
      ru: 'Вопрос История три',
    },
    option_count: 4,
    order_index: 2,
    status: 'review',
  },
  {
    id: 'q-4',
    question_text: {
      el: 'Μαθηματικά ερώτηση',
      en: 'Mastered question four',
      ru: 'Вопрос Выучено четыре',
    },
    option_count: 2,
    order_index: 3,
    status: 'mastered',
  },
];

// Wrapper with QueryClient + i18n (without BrowserRouter since renderWithProviders already provides one)
const createQueryWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(I18nextProvider, { i18n }, children)
    );
};

// Render helper that combines QueryClientProvider with renderWithProviders' i18n+router
function renderBrowser(props: { deckId: string; totalQuestions: number }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  return renderWithProviders(<QuestionBrowser {...props} />, { wrapper: Wrapper } as Parameters<
    typeof renderWithProviders
  >[1]);
}

// ============================================
// Tests
// ============================================

describe('QuestionBrowser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Loading State', () => {
    it('shows 6 skeleton cards while fetching', () => {
      vi.mocked(cultureDeckAPI.browseQuestions).mockReturnValue(new Promise(() => {}));

      renderBrowser({ deckId: 'deck-1', totalQuestions: 4 });

      const skeletons = screen.getAllByTestId('question-card-skeleton');
      expect(skeletons).toHaveLength(6);
    });
  });

  describe('Question Grid', () => {
    it('renders question grid with cards after data loads', async () => {
      vi.mocked(cultureDeckAPI.browseQuestions).mockResolvedValue(
        makeBrowseResponse(mockQuestions)
      );

      renderBrowser({ deckId: 'deck-1', totalQuestions: 4 });

      await waitFor(() => {
        expect(screen.getByTestId('question-grid')).toBeInTheDocument();
      });

      const cards = screen.getAllByTestId('question-card');
      expect(cards).toHaveLength(4);
    });
  });

  describe('Counter', () => {
    it('shows "Showing X of Y questions" counter', async () => {
      vi.mocked(cultureDeckAPI.browseQuestions).mockResolvedValue(
        makeBrowseResponse(mockQuestions)
      );

      renderBrowser({ deckId: 'deck-1', totalQuestions: 4 });

      await waitFor(() => {
        expect(screen.getByText(/Showing 4 of 4 questions/i)).toBeInTheDocument();
      });
    });
  });

  describe('Search', () => {
    it('filters questions by text with 300ms debounce', async () => {
      vi.mocked(cultureDeckAPI.browseQuestions).mockResolvedValue(
        makeBrowseResponse(mockQuestions)
      );

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      renderBrowser({ deckId: 'deck-1', totalQuestions: 4 });

      await waitFor(() => {
        expect(screen.getByText(/Showing 4 of 4 questions/i)).toBeInTheDocument();
      });

      const searchInput = screen.getByTestId('question-browser-search');

      // Before debounce - still shows all
      await user.type(searchInput, 'greece');
      expect(screen.getByText(/Showing 4 of 4 questions/i)).toBeInTheDocument();

      // After debounce - filtered
      act(() => {
        vi.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(screen.getByText(/Showing 1 of 4 questions/i)).toBeInTheDocument();
      });
    });

    it('search is case-insensitive', async () => {
      vi.mocked(cultureDeckAPI.browseQuestions).mockResolvedValue(
        makeBrowseResponse(mockQuestions)
      );

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      renderBrowser({ deckId: 'deck-1', totalQuestions: 4 });

      await waitFor(() => {
        expect(screen.getByText(/Showing 4 of 4 questions/i)).toBeInTheDocument();
      });

      const searchInput = screen.getByTestId('question-browser-search');
      await user.type(searchInput, 'GREECE');

      act(() => {
        vi.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(screen.getByText(/Showing 1 of 4 questions/i)).toBeInTheDocument();
      });
    });
  });

  describe('Filter Pills', () => {
    it('renders all 4 filter pills with correct counts', async () => {
      vi.mocked(cultureDeckAPI.browseQuestions).mockResolvedValue(
        makeBrowseResponse(mockQuestions)
      );

      renderBrowser({ deckId: 'deck-1', totalQuestions: 4 });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /All \(4\)/i })).toBeInTheDocument();
      });

      // mastered: 1, review (learning+review): 2, new: 1
      expect(screen.getByRole('button', { name: /Mastered \(1\)/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /In review \(2\)/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /New \(1\)/i })).toBeInTheDocument();
    });

    it('disables filter pills with count=0 except All', async () => {
      // Only mastered questions — new count = 0
      const masteredOnly = [
        {
          id: 'q-1',
          question_text: { el: 'Q1', en: 'Question one', ru: 'Вопрос один' },
          option_count: 4,
          order_index: 0,
          status: 'mastered' as const,
        },
      ];

      vi.mocked(cultureDeckAPI.browseQuestions).mockResolvedValue(makeBrowseResponse(masteredOnly));

      renderBrowser({ deckId: 'deck-1', totalQuestions: 1 });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /All \(1\)/i })).toBeInTheDocument();
      });

      // New pill count=0 → disabled
      const newButton = screen.getByRole('button', { name: /New \(0\)/i });
      expect(newButton).toBeDisabled();

      // All pill never disabled
      const allButton = screen.getByRole('button', { name: /All \(1\)/i });
      expect(allButton).not.toBeDisabled();
    });

    it('has filter group with aria-label', async () => {
      vi.mocked(cultureDeckAPI.browseQuestions).mockResolvedValue(
        makeBrowseResponse(mockQuestions)
      );

      renderBrowser({ deckId: 'deck-1', totalQuestions: 4 });

      await waitFor(() => {
        expect(screen.getByRole('group', { name: /Filter by status/i })).toBeInTheDocument();
      });
    });
  });

  describe('Empty Deck State', () => {
    it('shows empty deck state when questions array is empty', async () => {
      vi.mocked(cultureDeckAPI.browseQuestions).mockResolvedValue(makeBrowseResponse([]));

      renderBrowser({ deckId: 'deck-1', totalQuestions: 0 });

      await waitFor(() => {
        expect(screen.getByText('No questions in this deck yet')).toBeInTheDocument();
      });
    });
  });

  describe('Empty Search/Filter State', () => {
    it('shows empty search state when search matches nothing', async () => {
      vi.mocked(cultureDeckAPI.browseQuestions).mockResolvedValue(
        makeBrowseResponse(mockQuestions)
      );

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      renderBrowser({ deckId: 'deck-1', totalQuestions: 4 });

      await waitFor(() => {
        expect(screen.getByTestId('question-browser-search')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText(/Showing 4 of 4 questions/i)).toBeInTheDocument();
      });

      const searchInput = screen.getByTestId('question-browser-search');
      await user.type(searchInput, 'xyznonexistent');

      act(() => {
        vi.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(screen.getByText('No questions match your search')).toBeInTheDocument();
      });
    });

    it('shows "Clear search" action button in empty search state', async () => {
      vi.mocked(cultureDeckAPI.browseQuestions).mockResolvedValue(
        makeBrowseResponse(mockQuestions)
      );

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      renderBrowser({ deckId: 'deck-1', totalQuestions: 4 });

      await waitFor(() => {
        expect(screen.getByText(/Showing 4 of 4 questions/i)).toBeInTheDocument();
      });

      const searchInput = screen.getByTestId('question-browser-search');
      await user.type(searchInput, 'xyznonexistent');

      act(() => {
        vi.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(screen.getByText('No questions match your search')).toBeInTheDocument();
      });

      // Should have "Clear search" button in empty state
      const clearButtons = screen.getAllByRole('button', { name: /Clear search/i });
      expect(clearButtons.length).toBeGreaterThan(0);
    });
  });

  describe('Error State', () => {
    it('shows error state with retry button when API fails', async () => {
      vi.mocked(cultureDeckAPI.browseQuestions).mockRejectedValue(new Error('Network error'));

      renderBrowser({ deckId: 'deck-1', totalQuestions: 4 });

      await waitFor(() => {
        expect(screen.getByText('Failed to load questions')).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
    });
  });

  describe('Test IDs', () => {
    it('has data-testid="question-browser" on container', async () => {
      vi.mocked(cultureDeckAPI.browseQuestions).mockResolvedValue(makeBrowseResponse([]));

      renderBrowser({ deckId: 'deck-1', totalQuestions: 0 });

      await waitFor(() => {
        expect(screen.getByTestId('question-browser')).toBeInTheDocument();
      });
    });
  });
});
