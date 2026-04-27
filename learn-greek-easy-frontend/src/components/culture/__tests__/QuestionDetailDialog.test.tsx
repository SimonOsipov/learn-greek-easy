/**
 * QuestionDetailDialog Component Tests
 *
 * Tests for the QuestionDetailDialog component, covering:
 * - Loading skeleton state
 * - Content display (question text, options, correct answer highlight)
 * - Conditional sections (audio, image, news link, also-in-decks)
 * - Language toggle
 * - Error and retry state
 * - Analytics event firing
 */

import React from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { renderWithProviders } from '@/lib/test-utils';
import { cultureDeckAPI } from '@/services/cultureDeckAPI';
import type { CultureQuestionDetailResponse } from '@/types/culture';

import { QuestionDetailDialog } from '../QuestionDetailDialog';

// ============================================
// Mocks
// ============================================

vi.mock('@/services/cultureDeckAPI', () => ({
  cultureDeckAPI: {
    getQuestionDetail: vi.fn(),
  },
}));

vi.mock('@/lib/analytics', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/analytics')>();
  return {
    ...actual,
    track: vi.fn(),
  };
});

vi.mock('../WaveformPlayer', () => ({
  WaveformPlayer: ({ audioUrl, className }: { audioUrl?: string; className?: string }) => (
    <div data-testid="waveform-player" data-audio-url={audioUrl || ''} className={className}>
      <button data-testid="waveform-play-button">Play</button>
    </div>
  ),
}));

// Import after mock so we get the mocked version
import { track } from '@/lib/analytics';

// ============================================
// Test helpers
// ============================================

function makeDetailResponse(
  overrides: Partial<CultureQuestionDetailResponse> = {}
): CultureQuestionDetailResponse {
  return {
    id: 'q-1',
    question_text: {
      el: 'Ποια είναι η πρωτεύουσα;',
      en: 'What is the capital of Greece?',
      ru: 'Какова столица Греции?',
    },
    options: [
      { el: 'Αθήνα', en: 'Athens', ru: 'Афины' },
      { el: 'Θεσσαλονίκη', en: 'Thessaloniki', ru: 'Салоники' },
      { el: 'Πάτρα', en: 'Patras', ru: 'Патры' },
      { el: 'Ηράκλειο', en: 'Heraklion', ru: 'Ираклион' },
    ],
    option_count: 4,
    correct_option: 1,
    image_url: null,
    audio_url: null,
    order_index: 0,
    original_article_url: null,
    also_in_decks: [],
    status: 'new',
    ...overrides,
  };
}

function renderDialog(props: Partial<React.ComponentProps<typeof QuestionDetailDialog>> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return renderWithProviders(
    <QueryClientProvider client={queryClient}>
      <QuestionDetailDialog questionId="q-1" deckId="deck-1" onClose={vi.fn()} {...props} />
    </QueryClientProvider>
  );
}

// ============================================
// Tests
// ============================================

describe('QuestionDetailDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading State', () => {
    it('shows skeleton while fetching', () => {
      vi.mocked(cultureDeckAPI.getQuestionDetail).mockReturnValue(new Promise(() => {}));
      renderDialog();
      expect(screen.getByTestId('question-detail-skeleton')).toBeInTheDocument();
    });
  });

  describe('Content Display', () => {
    it('shows question text and all 4 options after load', async () => {
      vi.mocked(cultureDeckAPI.getQuestionDetail).mockResolvedValue(makeDetailResponse());
      renderDialog();

      await waitFor(() => {
        expect(screen.getByTestId('question-detail-text')).toHaveTextContent(
          'What is the capital of Greece?'
        );
      });

      expect(screen.getByTestId('option-0')).toBeInTheDocument();
      expect(screen.getByTestId('option-1')).toBeInTheDocument();
      expect(screen.getByTestId('option-2')).toBeInTheDocument();
      expect(screen.getByTestId('option-3')).toBeInTheDocument();
    });

    it('highlights correct answer with green styling and checkmark', async () => {
      vi.mocked(cultureDeckAPI.getQuestionDetail).mockResolvedValue(
        makeDetailResponse({ correct_option: 1 })
      );
      renderDialog();

      await waitFor(() => {
        const correctOption = screen.getByTestId('option-0');
        expect(correctOption.className).toContain('border-[hsl(var(--practice-correct))]');
      });
    });
  });

  describe('Conditional Sections', () => {
    it('hides audio section when audio_url is null', async () => {
      vi.mocked(cultureDeckAPI.getQuestionDetail).mockResolvedValue(
        makeDetailResponse({ audio_url: null })
      );
      renderDialog();

      await waitFor(() => {
        expect(screen.getByTestId('question-detail-text')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('question-detail-audio')).not.toBeInTheDocument();
    });

    it('shows WaveformPlayer when audio_url is present', async () => {
      vi.mocked(cultureDeckAPI.getQuestionDetail).mockResolvedValue(
        makeDetailResponse({ audio_url: 'https://example.com/audio.mp3' })
      );
      renderDialog();

      await waitFor(() => {
        expect(screen.getByTestId('question-detail-audio')).toBeInTheDocument();
      });
      expect(screen.getByTestId('waveform-player')).toBeInTheDocument();
    });

    it('hides image section when image_url is null', async () => {
      vi.mocked(cultureDeckAPI.getQuestionDetail).mockResolvedValue(
        makeDetailResponse({ image_url: null })
      );
      renderDialog();

      await waitFor(() => {
        expect(screen.getByTestId('question-detail-text')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('question-detail-image')).not.toBeInTheDocument();
    });

    it('hides news link when original_article_url is null', async () => {
      vi.mocked(cultureDeckAPI.getQuestionDetail).mockResolvedValue(
        makeDetailResponse({ original_article_url: null })
      );
      renderDialog();

      await waitFor(() => {
        expect(screen.getByTestId('question-detail-text')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('question-detail-news-link')).not.toBeInTheDocument();
    });

    it('shows news link with correct href and target when URL present', async () => {
      vi.mocked(cultureDeckAPI.getQuestionDetail).mockResolvedValue(
        makeDetailResponse({ original_article_url: 'https://example.com/article' })
      );
      renderDialog();

      await waitFor(() => {
        const link = screen.getByTestId('question-detail-news-link');
        expect(link).toHaveAttribute('href', 'https://example.com/article');
        expect(link).toHaveAttribute('target', '_blank');
      });
    });

    it('renders also-in-decks links when present', async () => {
      vi.mocked(cultureDeckAPI.getQuestionDetail).mockResolvedValue(
        makeDetailResponse({
          also_in_decks: [
            { id: 'deck-abc', name: 'History Deck' },
            { id: 'deck-def', name: 'Geography Deck' },
          ],
        })
      );
      renderDialog();

      await waitFor(() => {
        const section = screen.getByTestId('question-detail-also-in-decks');
        expect(section).toBeInTheDocument();
      });

      const links = screen.getByTestId('question-detail-also-in-decks').querySelectorAll('a');
      expect(links).toHaveLength(2);
      expect(links[0]).toHaveAttribute('href', '/culture/decks/deck-abc');
      expect(links[1]).toHaveAttribute('href', '/culture/decks/deck-def');
    });

    it('hides also-in-decks when array is empty', async () => {
      vi.mocked(cultureDeckAPI.getQuestionDetail).mockResolvedValue(
        makeDetailResponse({ also_in_decks: [] })
      );
      renderDialog();

      await waitFor(() => {
        expect(screen.getByTestId('question-detail-text')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('question-detail-also-in-decks')).not.toBeInTheDocument();
    });
  });

  describe('Language Toggle', () => {
    it('switches question text when language is changed', async () => {
      const user = userEvent.setup();
      vi.mocked(cultureDeckAPI.getQuestionDetail).mockResolvedValue(makeDetailResponse());
      renderDialog();

      await waitFor(() => {
        expect(screen.getByTestId('question-detail-text')).toHaveTextContent(
          'What is the capital of Greece?'
        );
      });

      // Click the EL button to switch to Greek
      const elButton = screen.getByRole('button', { name: /greek/i });
      await user.click(elButton);

      expect(screen.getByTestId('question-detail-text')).toHaveTextContent(
        'Ποια είναι η πρωτεύουσα;'
      );
    });
  });

  describe('Error State', () => {
    it('shows error message and retry button on failure', async () => {
      vi.mocked(cultureDeckAPI.getQuestionDetail).mockRejectedValue(new Error('Network error'));
      renderDialog();

      await waitFor(() => {
        expect(screen.getByTestId('question-detail-error')).toBeInTheDocument();
      });
      expect(screen.getByTestId('question-detail-retry')).toBeInTheDocument();
    });

    it('retries fetching when retry button is clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(cultureDeckAPI.getQuestionDetail)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(makeDetailResponse());

      renderDialog();

      await waitFor(() => {
        expect(screen.getByTestId('question-detail-retry')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('question-detail-retry'));

      await waitFor(() => {
        expect(cultureDeckAPI.getQuestionDetail).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Analytics', () => {
    it('fires track("culture_question_detail_viewed") on successful load', async () => {
      vi.mocked(cultureDeckAPI.getQuestionDetail).mockResolvedValue(makeDetailResponse());
      renderDialog();

      await waitFor(() => {
        expect(track).toHaveBeenCalledWith('culture_question_detail_viewed', {
          question_id: 'q-1',
          deck_id: 'deck-1',
          question_status: 'new',
        });
      });
    });
  });
});
