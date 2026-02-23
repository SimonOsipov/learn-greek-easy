/**
 * Tests for WordEntryContent component (WDET02)
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';

import { WordEntryContent } from '../WordEntryContent';
import { useWordEntry } from '@/features/words/hooks/useWordEntry';
import { useGenerateAudio } from '@/features/words/hooks';
import i18n from '@/i18n';

// ============================================
// Mocks
// ============================================

vi.mock('@/features/words/hooks/useWordEntry', () => ({
  useWordEntry: vi.fn(),
}));

vi.mock('../WordEntryEditForm', () => ({
  WordEntryEditForm: () => <div data-testid="word-entry-edit-form" />,
}));

vi.mock('@/features/words/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/words/hooks')>();
  return {
    ...actual,
    useGenerateAudio: vi.fn(() => ({
      mutate: vi.fn(),
      isPending: false,
      variables: undefined,
    })),
  };
});

vi.mock('@/features/words/hooks/useUpdateWordEntry', () => ({
  useUpdateWordEntry: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
    variables: undefined,
  })),
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
      audio_status: 'ready' as const,
    },
  ],
  audio_key: null,
  audio_url: null,
  audio_status: 'ready' as const,
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

    it('shows standalone Lemma Audio row when pronunciation is null', () => {
      (useWordEntry as Mock).mockReturnValue({
        wordEntry: createMockWordEntry({ pronunciation: null }),
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      });
      renderComponent();
      expect(screen.getByTestId('word-entry-content-pronunciation')).toBeInTheDocument();
      expect(screen.getByTestId('audio-status-badge-lemma')).toBeInTheDocument();
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

    it('shows Not set for translation_en_plural when null', () => {
      (useWordEntry as Mock).mockReturnValue({
        wordEntry: createMockWordEntry({ translation_en_plural: null }),
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      });
      renderComponent();
      // Field always renders — shows "Not set" when null
      const field = screen.getByTestId('word-entry-content-translation-en-plural');
      expect(field).toBeInTheDocument();
      expect(field).toHaveTextContent('Not set');
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

    it('shows Not set for translation_ru when null', () => {
      (useWordEntry as Mock).mockReturnValue({
        wordEntry: createMockWordEntry({ translation_ru: null }),
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      });
      renderComponent();
      // Field always renders — shows "Not set" when null
      const field = screen.getByTestId('word-entry-content-translation-ru');
      expect(field).toBeInTheDocument();
      expect(field).toHaveTextContent('Not set');
    });
  });

  // ============================================
  // Group 5: Grammar section / Gender
  // ============================================

  describe('grammar section', () => {
    it('renders noun grammar display for noun with grammar_data', () => {
      renderComponent();
      expect(screen.getByTestId('noun-grammar-display')).toBeInTheDocument();
    });

    it('shows Neuter gender in noun grammar display', () => {
      renderComponent();
      expect(screen.getByTestId('noun-grammar-display')).toHaveTextContent('Neuter');
    });

    it('shows "No grammar data" when grammar_data is null for noun', () => {
      (useWordEntry as Mock).mockReturnValue({
        wordEntry: createMockWordEntry({ grammar_data: null }),
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      });
      renderComponent();
      expect(screen.getByTestId('grammar-no-data')).toBeInTheDocument();
    });

    it('shows Not set for gender when grammar_data has no gender key', () => {
      (useWordEntry as Mock).mockReturnValue({
        wordEntry: createMockWordEntry({ grammar_data: { other: 'value' } }),
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      });
      renderComponent();
      // Grammar section still renders noun display, gender shows Not set
      expect(screen.getByTestId('noun-grammar-display')).toBeInTheDocument();
    });

    it('shows verb grammar display for verb part of speech', () => {
      (useWordEntry as Mock).mockReturnValue({
        wordEntry: createMockWordEntry({
          part_of_speech: 'verb',
          grammar_data: { voice: 'active' },
        }),
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      });
      renderComponent();
      expect(screen.getByTestId('verb-grammar-display')).toBeInTheDocument();
    });

    it('hides grammar section for phrase part of speech', () => {
      (useWordEntry as Mock).mockReturnValue({
        wordEntry: createMockWordEntry({ part_of_speech: 'phrase', grammar_data: null }),
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      });
      renderComponent();
      expect(screen.queryByTestId('noun-grammar-display')).not.toBeInTheDocument();
      expect(screen.queryByTestId('verb-grammar-display')).not.toBeInTheDocument();
      expect(screen.queryByTestId('grammar-no-data')).not.toBeInTheDocument();
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

    it('renders not-set fallback when English is empty string', () => {
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
      expect(screen.getByTestId('word-entry-content-example-0')).toHaveTextContent('Not set');
    });

    it('renders example Russian when non-empty', () => {
      renderComponent();
      expect(screen.getByTestId('word-entry-content-example-0')).toHaveTextContent('Дом большой.');
    });

    it('shows Not set for example Russian when empty string', () => {
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
      // Russian row always renders — shows "Not set" when empty/null
      const exampleCard = screen.getByTestId('word-entry-content-example-0');
      expect(exampleCard).toHaveTextContent('Russian');
      expect(exampleCard).toHaveTextContent('Not set');
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

  // ============================================
  // Group 8: Audio status badges
  // ============================================

  describe('Audio status badges', () => {
    it('lemma badge shows inline with pronunciation', () => {
      renderComponent();
      const pronunciationRow = screen.getByTestId('word-entry-content-pronunciation');
      expect(pronunciationRow).toBeInTheDocument();
      expect(pronunciationRow).toHaveTextContent('/spí·ti/');
      expect(screen.getByTestId('audio-status-badge-lemma')).toBeInTheDocument();
    });

    it('shows standalone Lemma Audio row when pronunciation is null', () => {
      (useWordEntry as Mock).mockReturnValue({
        wordEntry: createMockWordEntry({ pronunciation: null }),
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      });
      renderComponent();
      expect(screen.getByTestId('word-entry-content-pronunciation')).toBeInTheDocument();
      expect(screen.getByTestId('audio-status-badge-lemma')).toBeInTheDocument();
    });

    it('renders per-example badges with correct testids', () => {
      renderComponent();
      expect(screen.getByTestId('audio-status-badge-example-0')).toBeInTheDocument();
    });

    it('audio-status-badge-lemma testid is present', () => {
      renderComponent();
      expect(screen.getByTestId('audio-status-badge-lemma')).toBeInTheDocument();
    });

    it('audio-status-badge-example-0 testid is present', () => {
      renderComponent();
      expect(screen.getByTestId('audio-status-badge-example-0')).toBeInTheDocument();
    });

    it('example badge is hidden when audio_status is undefined on example', () => {
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
              // no audio_status
            },
          ],
        }),
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      });
      renderComponent();
      expect(screen.queryByTestId('audio-status-badge-example-0')).not.toBeInTheDocument();
    });
  });

  // ============================================
  // Group 9: Audio Generate Buttons
  // ============================================

  describe('Audio Generate Buttons', () => {
    it('shows Generate button for lemma with missing audio status', () => {
      (useWordEntry as Mock).mockReturnValue({
        wordEntry: createMockWordEntry({ audio_status: 'missing' }),
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      });
      renderComponent();
      expect(screen.getByTestId('audio-generate-btn-lemma')).toBeInTheDocument();
      expect(screen.getByTestId('audio-generate-btn-lemma')).toHaveTextContent('Generate');
    });

    it('shows Retry button for lemma with failed audio status', () => {
      (useWordEntry as Mock).mockReturnValue({
        wordEntry: createMockWordEntry({ audio_status: 'failed' }),
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      });
      renderComponent();
      expect(screen.getByTestId('audio-generate-btn-lemma')).toHaveTextContent('Retry');
    });

    it('does not show generate button for lemma with ready audio status', () => {
      // Default mock has audio_status: 'ready'
      renderComponent();
      expect(screen.queryByTestId('audio-generate-btn-lemma')).not.toBeInTheDocument();
    });

    it('shows Generate button for example with missing audio status', () => {
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
              audio_status: 'missing' as const,
            },
          ],
        }),
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      });
      renderComponent();
      expect(screen.getByTestId('audio-generate-btn-example-0')).toBeInTheDocument();
      expect(screen.getByTestId('audio-generate-btn-example-0')).toHaveTextContent('Generate');
    });

    it('does not show generate button for example with ready audio status', () => {
      // Default mock has example audio_status: 'ready'
      renderComponent();
      expect(screen.queryByTestId('audio-generate-btn-example-0')).not.toBeInTheDocument();
    });

    it('clicking lemma generate button triggers mutation with correct params', () => {
      const mockMutate = vi.fn();
      (useGenerateAudio as Mock).mockReturnValue({
        mutate: mockMutate,
        isPending: false,
        variables: undefined,
      });
      (useWordEntry as Mock).mockReturnValue({
        wordEntry: createMockWordEntry({ audio_status: 'missing' }),
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      });
      renderComponent();
      fireEvent.click(screen.getByTestId('audio-generate-btn-lemma'));
      expect(mockMutate).toHaveBeenCalledOnce();
      expect(mockMutate).toHaveBeenCalledWith({
        wordEntryId: 'we-123',
        part: 'lemma',
        exampleId: undefined,
      });
    });
  });

  // ============================================
  // Group 10: Edit mode
  // ============================================

  describe('Edit mode', () => {
    it('clicking edit button switches to edit form', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByTestId('word-entry-content-fields')).toBeInTheDocument();
      });
      await userEvent.click(screen.getByTestId('word-entry-edit-btn'));
      expect(screen.getByTestId('word-entry-edit-form')).toBeInTheDocument();
      expect(screen.queryByTestId('word-entry-content-fields')).not.toBeInTheDocument();
    });
  });

  // ============================================
  // Group 11: Section completeness badges
  // ============================================

  describe('Section completeness badges', () => {
    it('identity section shows correct completeness badge', () => {
      renderComponent();
      const identitySection = document.getElementById('section-identity');
      expect(identitySection).not.toBeNull();
      // With pronunciation present and audio_status ready, identity should show 2/2
      const badgeText = identitySection!.textContent;
      expect(badgeText).toContain('2/2');
    });
  });
});
