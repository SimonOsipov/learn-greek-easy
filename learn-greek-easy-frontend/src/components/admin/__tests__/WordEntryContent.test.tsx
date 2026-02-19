/**
 * Tests for WordEntryContent component (WDET02)
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';

import { WordEntryContent } from '../WordEntryContent';
import { useWordEntry } from '@/features/words/hooks/useWordEntry';
import i18n from '@/i18n';

// ============================================
// Mocks
// ============================================

vi.mock('@/features/words/hooks/useWordEntry', () => ({
  useWordEntry: vi.fn(),
}));

// ============================================
// Factory Functions
// ============================================

const createMockWordEntry = (overrides = {}) => ({
  id: 'we-123',
  deck_id: 'deck-456',
  lemma: 'σπίτι',
  part_of_speech: 'noun',
  translation_en: 'house',
  translation_en_plural: 'houses',
  translation_ru: 'дом',
  translation_ru_plural: null,
  pronunciation: '/spí·ti/',
  grammar_data: { gender: 'neuter' },
  examples: [
    {
      id: 'ex-1',
      greek: 'Το σπίτι είναι μεγάλο.',
      english: 'The house is big.',
      russian: 'Дом большой.',
      context: 'everyday',
      audio_key: null,
      audio_url: null,
    },
  ],
  audio_key: null,
  audio_url: null,
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

// ============================================
// Test Setup
// ============================================

beforeEach(() => {
  vi.clearAllMocks();
  (useWordEntry as Mock).mockReturnValue({
    wordEntry: createMockWordEntry(),
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });
});

function renderComponent(props = { wordEntryId: 'we-123' }) {
  return render(
    <I18nextProvider i18n={i18n}>
      <WordEntryContent {...props} />
    </I18nextProvider>
  );
}

// ============================================
// Tests
// ============================================

describe('WordEntryContent', () => {
  // ============================================
  // Group 1: Loading State
  // ============================================

  describe('loading state', () => {
    it('shows loading skeleton when isLoading is true', () => {
      (useWordEntry as Mock).mockReturnValue({
        wordEntry: null,
        isLoading: true,
        isError: false,
        refetch: vi.fn(),
      });
      renderComponent();
      expect(screen.getByTestId('word-entry-content-loading')).toBeInTheDocument();
    });
  });

  // ============================================
  // Group 2: Pronunciation
  // ============================================

  describe('pronunciation field', () => {
    it('renders pronunciation when present', () => {
      renderComponent();
      expect(screen.getByTestId('word-entry-content-pronunciation')).toBeInTheDocument();
      expect(screen.getByTestId('word-entry-content-pronunciation')).toHaveTextContent('/spí·ti/');
    });

    it('omits pronunciation when null', () => {
      (useWordEntry as Mock).mockReturnValue({
        wordEntry: createMockWordEntry({ pronunciation: null }),
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      });
      renderComponent();
      expect(screen.queryByTestId('word-entry-content-pronunciation')).not.toBeInTheDocument();
    });
  });

  // ============================================
  // Group 3: Translation EN Plural
  // ============================================

  describe('translation_en_plural field', () => {
    it('renders translation_en_plural when present', () => {
      renderComponent();
      expect(screen.getByTestId('word-entry-content-translation-en-plural')).toBeInTheDocument();
      expect(screen.getByTestId('word-entry-content-translation-en-plural')).toHaveTextContent(
        'houses'
      );
    });

    it('omits translation_en_plural when null', () => {
      (useWordEntry as Mock).mockReturnValue({
        wordEntry: createMockWordEntry({ translation_en_plural: null }),
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      });
      renderComponent();
      expect(
        screen.queryByTestId('word-entry-content-translation-en-plural')
      ).not.toBeInTheDocument();
    });
  });

  // ============================================
  // Group 4: Translation RU
  // ============================================

  describe('translation_ru field', () => {
    it('renders translation_ru when present', () => {
      renderComponent();
      expect(screen.getByTestId('word-entry-content-translation-ru')).toBeInTheDocument();
      expect(screen.getByTestId('word-entry-content-translation-ru')).toHaveTextContent('дом');
    });

    it('omits translation_ru when null', () => {
      (useWordEntry as Mock).mockReturnValue({
        wordEntry: createMockWordEntry({ translation_ru: null }),
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      });
      renderComponent();
      expect(screen.queryByTestId('word-entry-content-translation-ru')).not.toBeInTheDocument();
    });
  });

  // ============================================
  // Group 5: Gender
  // ============================================

  describe('gender field', () => {
    it('shows gender row for noun with grammar_data.gender', () => {
      renderComponent();
      expect(screen.getByTestId('word-entry-content-gender')).toBeInTheDocument();
      expect(screen.getByTestId('word-entry-content-gender')).toHaveTextContent('Neuter');
    });

    it('omits gender when grammar_data is null', () => {
      (useWordEntry as Mock).mockReturnValue({
        wordEntry: createMockWordEntry({ grammar_data: null }),
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      });
      renderComponent();
      expect(screen.queryByTestId('word-entry-content-gender')).not.toBeInTheDocument();
    });

    it('omits gender when grammar_data has no gender key', () => {
      (useWordEntry as Mock).mockReturnValue({
        wordEntry: createMockWordEntry({ grammar_data: { other: 'value' } }),
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      });
      renderComponent();
      expect(screen.queryByTestId('word-entry-content-gender')).not.toBeInTheDocument();
    });

    it('omits gender for non-noun part of speech even with grammar_data.gender', () => {
      (useWordEntry as Mock).mockReturnValue({
        wordEntry: createMockWordEntry({
          part_of_speech: 'verb',
          grammar_data: { gender: 'masculine' },
        }),
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      });
      renderComponent();
      expect(screen.queryByTestId('word-entry-content-gender')).not.toBeInTheDocument();
    });
  });

  // ============================================
  // Group 6: Examples Section
  // ============================================

  describe('examples section', () => {
    it('renders examples section', () => {
      renderComponent();
      expect(screen.getByTestId('word-entry-content-examples')).toBeInTheDocument();
    });

    it('renders example with Greek text', () => {
      renderComponent();
      expect(screen.getByTestId('word-entry-content-example-0')).toBeInTheDocument();
      expect(screen.getByTestId('word-entry-content-example-0')).toHaveTextContent(
        'Το σπίτι είναι μεγάλο.'
      );
    });

    it('renders example English text', () => {
      renderComponent();
      expect(screen.getByTestId('word-entry-content-example-0')).toHaveTextContent(
        'The house is big.'
      );
    });

    it('renders em-dash fallback when English is empty string', () => {
      (useWordEntry as Mock).mockReturnValue({
        wordEntry: createMockWordEntry({
          examples: [
            {
              id: 'ex-1',
              greek: 'Το σπίτι είναι μεγάλο.',
              english: '',
              russian: null,
              context: null,
              audio_key: null,
              audio_url: null,
            },
          ],
        }),
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      });
      renderComponent();
      expect(screen.getByTestId('word-entry-content-example-0')).toHaveTextContent('—');
    });

    it('renders example Russian when non-empty', () => {
      renderComponent();
      expect(screen.getByTestId('word-entry-content-example-0')).toHaveTextContent('Дом большой.');
    });

    it('omits example Russian when empty string', () => {
      (useWordEntry as Mock).mockReturnValue({
        wordEntry: createMockWordEntry({
          examples: [
            {
              id: 'ex-1',
              greek: 'Το σπίτι είναι μεγάλο.',
              english: 'The house is big.',
              russian: '',
              context: null,
              audio_key: null,
              audio_url: null,
            },
          ],
        }),
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      });
      renderComponent();
      // Russian label should not appear since russian is empty string (falsy)
      expect(screen.getByTestId('word-entry-content-example-0')).not.toHaveTextContent('Russian');
    });

    it('renders example Context when non-null', () => {
      renderComponent();
      expect(screen.getByTestId('word-entry-content-example-0')).toHaveTextContent('everyday');
    });

    it('omits example Context when null', () => {
      (useWordEntry as Mock).mockReturnValue({
        wordEntry: createMockWordEntry({
          examples: [
            {
              id: 'ex-1',
              greek: 'Το σπίτι είναι μεγάλο.',
              english: 'The house is big.',
              russian: null,
              context: null,
              audio_key: null,
              audio_url: null,
            },
          ],
        }),
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      });
      renderComponent();
      expect(screen.getByTestId('word-entry-content-example-0')).not.toHaveTextContent('Context');
    });

    it('shows no-examples state when examples is null', () => {
      (useWordEntry as Mock).mockReturnValue({
        wordEntry: createMockWordEntry({ examples: null }),
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      });
      renderComponent();
      expect(screen.getByTestId('word-entry-content-no-examples')).toBeInTheDocument();
    });

    it('shows no-examples state when examples is empty array', () => {
      (useWordEntry as Mock).mockReturnValue({
        wordEntry: createMockWordEntry({ examples: [] }),
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      });
      renderComponent();
      expect(screen.getByTestId('word-entry-content-no-examples')).toBeInTheDocument();
    });
  });

  // ============================================
  // Group 7: Error State
  // ============================================

  describe('error state', () => {
    it('shows error state with data-testid when isError is true', () => {
      (useWordEntry as Mock).mockReturnValue({
        wordEntry: null,
        isLoading: false,
        isError: true,
        refetch: vi.fn(),
      });
      renderComponent();
      expect(screen.getByTestId('word-entry-content-error')).toBeInTheDocument();
      expect(screen.getByTestId('word-entry-content-retry')).toBeInTheDocument();
    });

    it('retry button calls refetch', () => {
      const mockRefetch = vi.fn();
      (useWordEntry as Mock).mockReturnValue({
        wordEntry: null,
        isLoading: false,
        isError: true,
        refetch: mockRefetch,
      });
      renderComponent();
      fireEvent.click(screen.getByTestId('word-entry-content-retry'));
      expect(mockRefetch).toHaveBeenCalledOnce();
    });
  });
});
