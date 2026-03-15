/**
 * GenerateNounDialog Component Tests
 *
 * Tests for the GenerateNounDialog component covering:
 * - Modal open/close states
 * - Greek input validation (valid, Latin, mixed, empty)
 * - SSE-based streaming integration (loading, success, error states)
 * - Normalization result display (lemma, gender, POS, confidence badge)
 * - Start Over / Continue footer actions
 *
 * Related feature: [NGEN-08] Generate Noun Dialog
 */

import React from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { adminAPI, type ReverseLookupItem } from '@/services/adminAPI';
import { wordEntryAPI } from '@/services/wordEntryAPI';
import { toast } from '@/hooks/use-toast';

import { GenerateNounDialog, type GenerateNounDialogProps } from '../GenerateNounDialog';

// ============================================
// Mocks
// ============================================

vi.mock('@/services/adminAPI', () => ({
  GENERATE_WORD_ENTRY_STREAM_URL: '/api/v1/admin/word-entries/generate/stream',
  adminAPI: {
    generateWordEntry: vi.fn(),
    linkWordEntry: vi.fn().mockResolvedValue(undefined),
    reverseLookup: vi.fn(),
  },
}));

vi.mock('@/services/wordEntryAPI', () => ({
  wordEntryAPI: {
    createAndLink: vi
      .fn()
      .mockResolvedValue({ word_entry: { id: 'we-1' }, cards_created: 5, is_new: true }),
    generateAudioStreamUrl: vi.fn(
      (id: string) => `/api/v1/admin/word-entries/${id}/generate-audio/stream`
    ),
  },
}));

vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
}));

// Capture the onEvent callback so tests can fire SSE events
let capturedOnEvent: ((event: { type: string; data: unknown }) => void) | undefined;
let capturedOnError: ((err: Error) => void) | undefined;
const mockClose = vi.fn();

vi.mock('@/hooks/useSSE', () => ({
  useSSE: vi.fn(
    (
      _url: string,
      options: { onEvent?: (e: unknown) => void; onError?: (e: unknown) => void; enabled?: boolean }
    ) => {
      if (options.enabled) {
        capturedOnEvent = options.onEvent as typeof capturedOnEvent;
        capturedOnError = options.onError as typeof capturedOnError;
      }
      return { state: 'disconnected', close: mockClose };
    }
  ),
}));

// ============================================
// Test Utilities
// ============================================

const defaultProps: GenerateNounDialogProps = {
  open: true,
  onOpenChange: vi.fn(),
  deckId: 'deck-1',
  deckName: 'Animals & Nature',
};

const renderDialog = (overrides?: Partial<GenerateNounDialogProps>) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const props = { ...defaultProps, onOpenChange: vi.fn(), ...overrides };
  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        <GenerateNounDialog {...props} />
      </QueryClientProvider>
    ),
    props,
  };
};

/** Fire normalization_complete + duplicates_checked events to simulate basic pipeline result */
const fireNormalizationEvents = (overrides?: {
  confidence?: number;
  confidence_tier?: string;
  gender?: string | null;
  article?: string | null;
  corrected_from?: string | null;
  corrected_to?: string | null;
  strategy?: string | null;
  suggestions?: Array<{
    lemma: string;
    pos: string;
    gender: string | null;
    article: string | null;
    confidence: number;
    confidence_tier: string;
    strategy: string;
  }>;
  duplicate?: {
    is_duplicate: boolean;
    word_entry_id: string | null;
    existing_entry: {
      id: string;
      lemma: string;
      part_of_speech: string;
      translation_en: string;
      translation_ru: string | null;
      pronunciation: string | null;
    } | null;
    matched_decks: { deck_id: string; deck_name: string }[];
  };
}) => {
  act(() => {
    capturedOnEvent?.({
      type: 'normalization_complete',
      data: {
        normalization: {
          input_word: 'γάτα',
          lemma: 'γάτα',
          gender: overrides?.gender !== undefined ? overrides.gender : 'feminine',
          article: overrides?.article !== undefined ? overrides.article : 'η',
          pos: 'NOUN',
          confidence: overrides?.confidence ?? 1.0,
          confidence_tier: overrides?.confidence_tier ?? 'high',
          strategy: overrides?.strategy !== undefined ? overrides.strategy : null,
          corrected_from: overrides?.corrected_from !== undefined ? overrides.corrected_from : null,
          corrected_to: overrides?.corrected_to !== undefined ? overrides.corrected_to : null,
        },
        suggestions: overrides?.suggestions ?? [],
      },
    });
    capturedOnEvent?.({
      type: 'duplicates_checked',
      data: overrides?.duplicate ?? {
        is_duplicate: false,
        word_entry_id: null,
        existing_entry: null,
        matched_decks: [],
      },
    });
  });
};

const mockGenerationData = {
  lemma: 'γάτα',
  part_of_speech: 'noun' as const,
  translation_en: 'cat',
  translation_en_plural: 'cats',
  translation_ru: 'кошка',
  translation_ru_plural: 'кошки',
  pronunciation: '/ˈɣa.ta/',
  grammar_data: {
    gender: 'feminine' as const,
    declension_group: 'feminine_a',
    cases: {
      singular: {
        nominative: 'η γάτα',
        genitive: 'της γάτας',
        accusative: 'τη γάτα',
        vocative: 'γάτα',
      },
      plural: {
        nominative: 'οι γάτες',
        genitive: 'των γατών',
        accusative: 'τις γάτες',
        vocative: 'γάτες',
      },
    },
  },
  examples: [
    { id: 1, greek: 'Η γάτα κοιμάται.', english: 'The cat is sleeping.', russian: 'Кошка спит.' },
    {
      id: 2,
      greek: 'Οι γάτες παίζουν.',
      english: 'The cats are playing.',
      russian: 'Кошки играют.',
    },
  ],
};

const mockTranslationLookup = {
  en: {
    translations: ['cat'],
    combined_text: 'cat',
    source: 'dictionary' as const,
    sense_count: 1,
  },
  ru: {
    translations: ['кошка'],
    combined_text: 'кошка',
    source: 'dictionary' as const,
    sense_count: 1,
  },
};

const mockVerificationData = {
  combined_tier: 'auto_approve' as const,
  morphology_source: 'spacy' as const,
  local: {
    tier: 'auto_approve' as const,
    fail_count: 0,
    warn_count: 0,
    fields: [],
  },
  cross_ai: null,
};

/** Fire full pipeline events including generation */
const fireGenerationEvents = (overrides?: {
  generation?: typeof mockGenerationData | null;
  translation_lookup?: typeof mockTranslationLookup | null;
}) => {
  fireNormalizationEvents();
  act(() => {
    capturedOnEvent?.({ type: 'generation_started', data: {} });
    capturedOnEvent?.({
      type: 'generation_complete',
      data: overrides?.generation !== undefined ? overrides.generation : mockGenerationData,
    });
    if (overrides?.translation_lookup !== null) {
      capturedOnEvent?.({
        type: 'translations_found',
        data: {
          data:
            overrides?.translation_lookup !== undefined
              ? overrides.translation_lookup
              : mockTranslationLookup,
        },
      });
    }
    capturedOnEvent?.({ type: 'pipeline_complete', data: {} });
  });
};

/** Fire full pipeline events including generation and verification */
const fireFullPipelineEvents = () => {
  fireNormalizationEvents();
  act(() => {
    capturedOnEvent?.({ type: 'generation_started', data: {} });
    capturedOnEvent?.({ type: 'generation_complete', data: mockGenerationData });
    capturedOnEvent?.({ type: 'verification_complete', data: mockVerificationData });
    capturedOnEvent?.({ type: 'pipeline_complete', data: {} });
  });
};

/** Helper: type a word and click submit */
const submitWord = async (user: ReturnType<typeof userEvent.setup>, word = 'γάτα') => {
  await user.type(screen.getByTestId('generate-noun-input'), word);
  await user.click(screen.getByTestId('generate-noun-submit'));
};

const mockReverseLookupResults: ReverseLookupItem[] = [
  {
    lemma: 'γάτα',
    pos: 'NOUN',
    gender: 'feminine',
    article: 'η',
    translations: ['cat', 'kitty'],
    score: 3.0,
    inferred_gender: false,
  },
  {
    lemma: 'γατί',
    pos: 'NOUN',
    gender: 'neuter',
    article: 'το',
    translations: ['kitten'],
    score: 2.0,
    inferred_gender: true,
  },
];

// ============================================
// Tests
// ============================================

describe('GenerateNounDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedOnEvent = undefined;
    capturedOnError = undefined;
  });

  // 1. Renders modal when open
  it('renders modal when open', () => {
    renderDialog();

    expect(screen.getByTestId('generate-noun-dialog')).toBeInTheDocument();
    expect(screen.getByText('Generate Noun')).toBeInTheDocument();
    expect(screen.getByTestId('generate-noun-input')).toBeInTheDocument();
    expect(screen.getByTestId('generate-noun-submit')).toBeDisabled();
  });

  // 2. Does not render when closed
  it('does not render when closed', () => {
    renderDialog({ open: false });

    expect(screen.queryByTestId('generate-noun-dialog')).not.toBeInTheDocument();
  });

  // 3. Displays deck name
  it('displays deck name', () => {
    renderDialog();

    expect(screen.getByTestId('generate-noun-deck-name')).toHaveTextContent('Animals & Nature');
  });

  // 4. Greek input enables Create
  it('enables Create button when valid Greek is typed', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.type(screen.getByTestId('generate-noun-input'), 'σπίτι');

    expect(screen.getByTestId('generate-noun-submit')).not.toBeDisabled();
    expect(screen.queryByTestId('generate-noun-warning')).not.toBeInTheDocument();
  });

  // 5. Latin input enables Create (triggers reverse lookup instead of showing warning)
  it('enables Create and shows no warning for Latin input', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.type(screen.getByTestId('generate-noun-input'), 'spiti');

    expect(screen.queryByTestId('generate-noun-warning')).not.toBeInTheDocument();
    expect(screen.getByTestId('generate-noun-submit')).not.toBeDisabled();
  });

  // 6. Mixed Greek/Latin input shows warning and disables submit
  it('shows mixed-script warning and disables submit for mixed Greek/Latin input', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.type(screen.getByTestId('generate-noun-input'), 'σπίτιtest');

    expect(screen.getByTestId('generate-noun-warning')).toBeInTheDocument();
    expect(screen.getByTestId('generate-noun-submit')).toBeDisabled();
  });

  // 7. Empty input disables Create without warning
  it('disables Create without showing warning when input is empty', () => {
    renderDialog();

    expect(screen.getByTestId('generate-noun-submit')).toBeDisabled();
    expect(screen.queryByTestId('generate-noun-warning')).not.toBeInTheDocument();
  });

  // 8. Submit shows loading spinner (streaming state)
  it('shows loading spinner after clicking Create', async () => {
    const user = userEvent.setup();
    renderDialog();

    await submitWord(user);

    expect(screen.getByTestId('generate-noun-submit')).toBeDisabled();
    const submitBtn = screen.getByTestId('generate-noun-submit');
    expect(submitBtn.querySelector('svg')).toBeTruthy();
  });

  // 9. Input disabled during loading
  it('disables input during loading', async () => {
    const user = userEvent.setup();
    renderDialog();

    await submitWord(user);

    expect(screen.getByTestId('generate-noun-input')).toBeDisabled();
  });

  // 10. Result card displayed on success
  it('displays normalization result card on success', async () => {
    const user = userEvent.setup();
    renderDialog();

    await submitWord(user);
    fireNormalizationEvents();

    await waitFor(() => {
      expect(screen.getByTestId('generate-noun-result')).toBeInTheDocument();
    });
  });

  // 11. Lemma displayed correctly
  it('shows lemma in result', async () => {
    const user = userEvent.setup();
    renderDialog();

    await submitWord(user);
    fireNormalizationEvents();

    await waitFor(() => {
      expect(screen.getByTestId('result-lemma')).toHaveTextContent('γάτα');
    });
  });

  // 12. Gender + article displayed
  it('shows gender with article in result', async () => {
    const user = userEvent.setup();
    renderDialog();

    await submitWord(user);
    fireNormalizationEvents();

    await waitFor(() => {
      expect(screen.getByTestId('result-gender')).toHaveTextContent('feminine (η)');
    });
  });

  // 13. POS displayed (title-cased: NOUN → Noun)
  it('shows POS in result', async () => {
    const user = userEvent.setup();
    renderDialog();

    await submitWord(user);
    fireNormalizationEvents();

    await waitFor(() => {
      expect(screen.getByTestId('result-pos')).toHaveTextContent('Noun');
    });
  });

  // 14. High confidence badge has green class
  it('shows high confidence badge with green class', async () => {
    const user = userEvent.setup();
    renderDialog();

    await submitWord(user);
    fireNormalizationEvents({ confidence: 0.9, confidence_tier: 'high' });

    await waitFor(() => {
      const badge = screen.getByTestId('result-confidence-badge');
      expect(badge.className).toContain('bg-green-100');
    });
  });

  // 15. Medium confidence badge has amber class
  it('shows medium confidence badge with amber class', async () => {
    const user = userEvent.setup();
    renderDialog();

    await submitWord(user);
    fireNormalizationEvents({ confidence: 0.6, confidence_tier: 'medium' });

    await waitFor(() => {
      const badge = screen.getByTestId('result-confidence-badge');
      expect(badge.className).toContain('bg-amber-100');
    });
  });

  // 16. Low confidence badge has red class
  it('shows low confidence badge with red class', async () => {
    const user = userEvent.setup();
    renderDialog();

    await submitWord(user);
    fireNormalizationEvents({ confidence: 0.2, confidence_tier: 'low' });

    await waitFor(() => {
      const badge = screen.getByTestId('result-confidence-badge');
      expect(badge.className).toContain('bg-red-100');
    });
  });

  // 17. Badge shows numeric score and tier label
  it('shows confidence score and tier label in badge', async () => {
    const user = userEvent.setup();
    renderDialog();

    await submitWord(user);
    fireNormalizationEvents({ confidence: 1.0, confidence_tier: 'high' });

    await waitFor(() => {
      const badge = screen.getByTestId('result-confidence-badge');
      expect(badge.textContent).toContain('1.00');
    });
  });

  // 18. Low confidence warning shown when tier is low
  it('shows low confidence warning when tier is low', async () => {
    const user = userEvent.setup();
    renderDialog();

    await submitWord(user);
    fireNormalizationEvents({ confidence: 0.2, confidence_tier: 'low' });

    await waitFor(() => {
      expect(screen.getByTestId('result-low-confidence-warning')).toBeInTheDocument();
    });
  });

  // 19. Low confidence warning hidden when tier is high
  it('hides low confidence warning when tier is high', async () => {
    const user = userEvent.setup();
    renderDialog();

    await submitWord(user);
    fireNormalizationEvents({ confidence: 1.0, confidence_tier: 'high' });

    await waitFor(() => {
      expect(screen.getByTestId('generate-noun-result')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('result-low-confidence-warning')).not.toBeInTheDocument();
  });

  // 20. Error alert on stream error
  it('shows error alert on stream error', async () => {
    const user = userEvent.setup();
    renderDialog();

    await submitWord(user);

    act(() => {
      capturedOnError?.(new Error('Active deck not found'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('generate-noun-error')).toBeInTheDocument();
    });

    expect(screen.getByTestId('generate-noun-error')).toHaveTextContent('Active deck not found');
  });

  // 21. Error clears when input changes
  it('clears error when input changes', async () => {
    const user = userEvent.setup();
    renderDialog();

    await submitWord(user);

    act(() => {
      capturedOnError?.(new Error('Active deck not found'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('generate-noun-error')).toBeInTheDocument();
    });

    // Error is shown in the pre-result panel, so we need to be in error state (no result yet)
    // Typing in input clears apiError
    await user.type(screen.getByTestId('generate-noun-input'), 'α');

    expect(screen.queryByTestId('generate-noun-error')).not.toBeInTheDocument();
  });

  // 22. Start Over resets to input state
  it('Start Over resets to input state after result', async () => {
    const user = userEvent.setup();
    renderDialog();

    await submitWord(user);
    fireNormalizationEvents();

    await waitFor(() => {
      expect(screen.getByTestId('generate-noun-result')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('generate-noun-start-over'));

    expect(screen.queryByTestId('generate-noun-result')).not.toBeInTheDocument();
    expect(screen.getByTestId('generate-noun-input')).toBeInTheDocument();
    expect(screen.getByTestId('generate-noun-input')).toHaveValue('');
  });

  // 23. Create button enabled after pipeline_failed (retry)
  it('Create button remains enabled after pipeline error for retry', async () => {
    const user = userEvent.setup();
    renderDialog();

    await submitWord(user);

    act(() => {
      capturedOnEvent?.({
        type: 'pipeline_failed',
        data: { error: 'Pipeline failed' },
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('generate-noun-submit')).not.toBeDisabled();
    });
  });

  // 24. Continue button removed — only Start Over remains
  it('does not render Continue button after result', async () => {
    const user = userEvent.setup();
    renderDialog();

    await submitWord(user);
    fireNormalizationEvents();

    await waitFor(() => {
      expect(screen.getByTestId('generate-noun-result')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('generate-noun-continue')).not.toBeInTheDocument();
  });

  // 25. No correction note when corrected_from is null
  it('does not show correction note when corrected_from is null', async () => {
    const user = userEvent.setup();
    renderDialog();

    await submitWord(user);
    fireNormalizationEvents();

    await waitFor(() => {
      expect(screen.getByTestId('generate-noun-result')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('correction-note')).not.toBeInTheDocument();
  });

  // 26. Shows correction note when corrected_from and corrected_to are set
  it('shows correction note when corrected_from and corrected_to are set', async () => {
    const user = userEvent.setup();
    renderDialog();

    await submitWord(user, 'σπιτι');
    fireNormalizationEvents({ corrected_from: 'σπιτι', corrected_to: 'σπίτι' });

    await waitFor(() => {
      expect(screen.getByTestId('correction-note')).toBeInTheDocument();
    });

    expect(screen.getByTestId('correction-note')).toHaveTextContent('σπιτι');
  });

  // 27. No suggestions section when suggestions is empty
  it('does not show suggestions section when suggestions is empty', async () => {
    const user = userEvent.setup();
    renderDialog();

    await submitWord(user);
    fireNormalizationEvents();

    await waitFor(() => {
      expect(screen.getByTestId('generate-noun-result')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('suggestions-section')).not.toBeInTheDocument();
  });

  // 28. Renders suggestion rows
  it('renders suggestion rows when suggestions are provided', async () => {
    const user = userEvent.setup();
    renderDialog();

    await submitWord(user);
    fireNormalizationEvents({
      suggestions: [
        {
          lemma: 'γάτος',
          pos: 'NOUN',
          gender: 'masculine',
          article: 'ο',
          confidence: 0.8,
          confidence_tier: 'medium',
          strategy: 'article_prefix',
        },
        {
          lemma: 'γατάκι',
          pos: 'NOUN',
          gender: 'neuter',
          article: 'το',
          confidence: 0.6,
          confidence_tier: 'medium',
          strategy: 'article_prefix',
        },
      ],
    });

    await waitFor(() => {
      expect(screen.getByTestId('suggestions-section')).toBeInTheDocument();
    });

    expect(screen.getByTestId('suggestion-row-0')).toBeInTheDocument();
    expect(screen.getByTestId('suggestion-row-1')).toBeInTheDocument();
    expect(screen.getByTestId('suggestion-row-0')).toHaveTextContent('γάτος');
    expect(screen.getByTestId('suggestion-row-1')).toHaveTextContent('γατάκι');
  });

  // 29. Click Use swaps suggestion into primary display
  it('swaps suggestion into primary display when Use is clicked', async () => {
    const user = userEvent.setup();
    renderDialog();

    await submitWord(user);
    fireNormalizationEvents({
      suggestions: [
        {
          lemma: 'γάτος',
          pos: 'NOUN',
          gender: 'masculine',
          article: 'ο',
          confidence: 0.8,
          confidence_tier: 'medium',
          strategy: 'article_prefix',
        },
      ],
    });

    await waitFor(() => {
      expect(screen.getByTestId('suggestion-row-0')).toBeInTheDocument();
    });

    expect(screen.getByTestId('result-lemma')).toHaveTextContent('γάτα');

    await user.click(screen.getByTestId('suggestion-use-0'));

    expect(screen.getByTestId('result-lemma')).toHaveTextContent('γάτος');
    expect(screen.getByTestId('suggestion-row-0')).toHaveTextContent('γάτα');
  });

  // 30. Round-trip swap — swap A→B→A returns to original
  it('round-trip swap returns to original values', async () => {
    const user = userEvent.setup();
    renderDialog();

    await submitWord(user);
    fireNormalizationEvents({
      suggestions: [
        {
          lemma: 'γάτος',
          pos: 'NOUN',
          gender: 'masculine',
          article: 'ο',
          confidence: 0.8,
          confidence_tier: 'medium',
          strategy: 'article_prefix',
        },
      ],
    });

    await waitFor(() => {
      expect(screen.getByTestId('suggestion-row-0')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('suggestion-use-0'));
    expect(screen.getByTestId('result-lemma')).toHaveTextContent('γάτος');

    await user.click(screen.getByTestId('suggestion-use-0'));
    expect(screen.getByTestId('result-lemma')).toHaveTextContent('γάτα');
    expect(screen.getByTestId('suggestion-row-0')).toHaveTextContent('γάτος');
  });

  // 31. No-duplicate banner shown
  it('shows no-duplicate banner when is_duplicate is false', async () => {
    const user = userEvent.setup();
    renderDialog();

    await submitWord(user);
    fireNormalizationEvents();

    await waitFor(() => {
      expect(screen.getByTestId('no-duplicate-banner')).toBeInTheDocument();
    });
  });

  // 32. Duplicate found warning shown
  it('shows duplicate warning when is_duplicate is true', async () => {
    const user = userEvent.setup();
    renderDialog();

    await submitWord(user);
    fireNormalizationEvents({
      duplicate: {
        is_duplicate: true,
        word_entry_id: 'entry-1',
        existing_entry: {
          id: 'entry-1',
          lemma: 'γάτα',
          part_of_speech: 'NOUN',
          translation_en: 'cat',
          translation_ru: null,
          pronunciation: null,
        },
        matched_decks: [{ deck_id: 'deck-2', deck_name: 'Animals' }],
      },
    });

    await waitFor(() => {
      expect(screen.getByTestId('duplicate-found-warning')).toBeInTheDocument();
    });
    expect(screen.getByTestId('duplicate-found-warning')).toHaveTextContent('Animals');
    expect(screen.getByTestId('duplicate-found-warning')).toHaveTextContent('cat');
  });

  // 33. Continue button removed even when duplicate found
  it('does not render Continue button even when duplicate found', async () => {
    const user = userEvent.setup();
    renderDialog();

    await submitWord(user);
    fireNormalizationEvents({
      duplicate: {
        is_duplicate: true,
        word_entry_id: 'entry-1',
        existing_entry: {
          id: 'entry-1',
          lemma: 'γάτα',
          part_of_speech: 'NOUN',
          translation_en: 'cat',
          translation_ru: null,
          pronunciation: null,
        },
        matched_decks: [{ deck_id: 'deck-2', deck_name: 'Animals' }],
      },
    });

    await waitFor(() => {
      expect(screen.getByTestId('duplicate-found-warning')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('generate-noun-continue')).not.toBeInTheDocument();
  });

  // 35. Displays examples
  it('displays example sentences', async () => {
    const user = userEvent.setup();
    renderDialog();

    await submitWord(user);
    fireGenerationEvents();

    await waitFor(() => {
      expect(screen.getByTestId('examples-section')).toBeInTheDocument();
    });
    expect(screen.getByTestId('gen-example-1')).toHaveTextContent('Η γάτα κοιμάται.');
    expect(screen.getByTestId('gen-example-2')).toHaveTextContent('Οι γάτες παίζουν.');
  });

  // 40. Wide layout when verification present
  it('expands dialog to wide layout when verification is present', async () => {
    const user = userEvent.setup();
    renderDialog();

    await submitWord(user);
    fireFullPipelineEvents();

    await waitFor(() => {
      expect(screen.getByTestId('verification-section')).toBeInTheDocument();
    });

    const dialog = screen.getByTestId('generate-noun-dialog');
    expect(dialog.className).toContain('sm:max-w-[1200px]');
  });

  // 41. Narrow layout before verification
  it('keeps narrow layout before verification completes', async () => {
    const user = userEvent.setup();
    renderDialog();

    await submitWord(user);
    fireGenerationEvents();

    await waitFor(() => {
      expect(screen.getByTestId('generate-noun-result')).toBeInTheDocument();
    });

    const dialog = screen.getByTestId('generate-noun-dialog');
    expect(dialog.className).not.toContain('sm:max-w-[1100px]');
    expect(dialog.className).toContain('sm:max-w-[650px]');

    const contentArea = screen.getByTestId('generate-noun-content-area');
    expect(contentArea.className).not.toContain('grid-cols-2');
    expect(contentArea.className).toContain('space-y-4');
  });

  // 42. Hides examples when generation event not fired
  it('hides examples section when generation event not fired', async () => {
    const user = userEvent.setup();
    renderDialog();

    await submitWord(user);
    fireNormalizationEvents();

    await waitFor(() => {
      expect(screen.getByTestId('generate-noun-result')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('examples-section')).not.toBeInTheDocument();
  });

  // 43. Start Over clears examples section
  it('Start Over clears examples section', async () => {
    const user = userEvent.setup();
    renderDialog();

    await submitWord(user);
    fireGenerationEvents();

    await waitFor(() => {
      expect(screen.getByTestId('examples-section')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('generate-noun-start-over'));

    expect(screen.queryByTestId('examples-section')).not.toBeInTheDocument();
    expect(screen.getByTestId('generate-noun-input')).toBeInTheDocument();
  });

  // 41. Start Over clears swap state (existing test)
  it('Start Over clears swap state and returns to input form', async () => {
    const user = userEvent.setup();
    renderDialog();

    await submitWord(user);
    fireNormalizationEvents({
      suggestions: [
        {
          lemma: 'γάτος',
          pos: 'NOUN',
          gender: 'masculine',
          article: 'ο',
          confidence: 0.8,
          confidence_tier: 'medium',
          strategy: 'article_prefix',
        },
      ],
    });

    await waitFor(() => {
      expect(screen.getByTestId('suggestion-row-0')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('suggestion-use-0'));
    expect(screen.getByTestId('result-lemma')).toHaveTextContent('γάτος');

    await user.click(screen.getByTestId('generate-noun-start-over'));

    expect(screen.queryByTestId('generate-noun-result')).not.toBeInTheDocument();
    expect(screen.getByTestId('generate-noun-input')).toBeInTheDocument();
    expect(screen.queryByTestId('suggestions-section')).not.toBeInTheDocument();
  });

  // 44. Examples and verification coexist after full pipeline
  it('shows examples section after full pipeline completes', async () => {
    const user = userEvent.setup();
    renderDialog();

    await submitWord(user);
    fireFullPipelineEvents();

    await waitFor(() => {
      expect(screen.getByTestId('verification-section')).toBeInTheDocument();
    });
    expect(screen.getByTestId('examples-section')).toBeInTheDocument();
    expect(screen.getByTestId('gen-example-1')).toHaveTextContent('Η γάτα κοιμάται.');
  });

  // 45. Examples section hidden when generation has no examples
  it('hides examples section when generation has no examples', async () => {
    const user = userEvent.setup();
    renderDialog();

    await submitWord(user);
    fireGenerationEvents({ generation: { ...mockGenerationData, examples: [] } });

    await waitFor(() => {
      expect(screen.getByTestId('generate-noun-result')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('examples-section')).not.toBeInTheDocument();
  });

  // ============================================================
  // Editable fields (AC #5)
  // ============================================================

  // 46. Decision pills rendered in verification table after pipeline done
  it('renders decision pills in verification table when pipeline is done', async () => {
    const user = userEvent.setup();
    renderDialog();

    await submitWord(user);
    fireFullPipelineEvents();

    await waitFor(() => {
      expect(screen.getByTestId('approve-save-button')).toBeInTheDocument();
    });
    // Translations and pronunciation are now shown as decision pills in the verification table
    expect(screen.getByTestId('verification-section')).toBeInTheDocument();
  });

  // 47. Translation values accessible via resolved values (no longer in separate inputs)
  it('shows generation result after pipeline and approve button is enabled', async () => {
    const user = userEvent.setup();
    renderDialog();

    await submitWord(user);
    fireFullPipelineEvents();

    await waitFor(() => {
      expect(screen.getByTestId('approve-save-button')).not.toBeDisabled();
    });
    // Generation data is populated into resolvedValues and approve is enabled
    expect(screen.getByTestId('approve-save-button')).not.toBeDisabled();
  });

  // 48. Examples section visible when pipeline done (inline editable by default)
  it('shows examples section with example text when pipeline is done', async () => {
    const user = userEvent.setup();
    renderDialog();

    await submitWord(user);
    fireFullPipelineEvents();

    await waitFor(() => {
      expect(screen.getByTestId('examples-section')).toBeInTheDocument();
    });
    // Examples are always visible as inline-editable spans
    expect(screen.getByTestId('editable-example-0-greek')).toBeInTheDocument();
    expect(screen.getByTestId('editable-example-0-greek')).toHaveTextContent('Η γάτα κοιμάται.');
  });

  // 49. Clicking example text activates inline input (AC #5)
  it('activates inline input when example text is clicked', async () => {
    const user = userEvent.setup();
    renderDialog();

    await submitWord(user);
    fireFullPipelineEvents();

    await waitFor(() => {
      expect(screen.getByTestId('examples-section')).toBeInTheDocument();
    });

    // Click on the greek example text to enter edit mode
    await user.click(screen.getByTestId('editable-example-0-greek'));

    // After click, the span becomes an input element
    await waitFor(() => {
      const input = screen.getByTestId('editable-example-0-greek');
      expect(input.tagName).toBe('INPUT');
    });
  });

  // ============================================================
  // Approve & Save button visibility (AC #8)
  // ============================================================

  // 50. Approve & Save button visible when pipeline done with generation + verification
  it('shows Approve & Save button when pipeline done with generation and verification', async () => {
    const user = userEvent.setup();
    renderDialog();

    await submitWord(user);
    fireFullPipelineEvents();

    await waitFor(() => {
      expect(screen.getByTestId('approve-save-button')).toBeInTheDocument();
    });
  });

  // 51. Approve & Save button NOT visible when pipeline done but no verification
  it('does not show Approve & Save button when verification is absent', async () => {
    const user = userEvent.setup();
    renderDialog();

    await submitWord(user);
    fireGenerationEvents();

    await waitFor(() => {
      expect(screen.getByTestId('generate-noun-result')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('approve-save-button')).not.toBeInTheDocument();
  });

  // 52. Approve & Save enabled when generation provides EN translation via resolvedValues (AC #6)
  it('enables Approve & Save when generation data provides EN translation', async () => {
    const user = userEvent.setup();
    renderDialog();

    await submitWord(user);
    fireFullPipelineEvents();

    await waitFor(() => {
      expect(screen.getByTestId('approve-save-button')).toBeInTheDocument();
    });

    // With generation data providing translation_en='cat', approve button should be enabled
    expect(screen.getByTestId('approve-save-button')).not.toBeDisabled();
  });

  // 53. Approve & Save enabled when EN translation is present
  it('enables Approve & Save when EN translation is non-empty', async () => {
    const user = userEvent.setup();
    renderDialog();

    await submitWord(user);
    fireFullPipelineEvents();

    await waitFor(() => {
      expect(screen.getByTestId('approve-save-button')).not.toBeDisabled();
    });
  });

  // ============================================================
  // Approve & Save success flow (AC #15)
  // ============================================================

  // 54. On success: createAndLink called, toast shown, audio generation starts (dialog stays open)
  it('calls createAndLink and shows success toast on approve, then starts audio generation', async () => {
    const mockCreateAndLink = vi.mocked(wordEntryAPI.createAndLink);
    mockCreateAndLink.mockResolvedValueOnce({
      word_entry: { id: 'we-1' } as never,
      cards_created: 5,
      is_new: true,
    });
    const mockToast = vi.mocked(toast);

    const onWordLinked = vi.fn();
    const onOpenChange = vi.fn();
    const user = userEvent.setup();

    renderDialog({ onWordLinked, onOpenChange });

    await submitWord(user);
    fireFullPipelineEvents();

    await waitFor(() => {
      expect(screen.getByTestId('approve-save-button')).not.toBeDisabled();
    });

    await user.click(screen.getByTestId('approve-save-button'));

    await waitFor(() => {
      expect(mockCreateAndLink).toHaveBeenCalledWith(
        'deck-1',
        expect.objectContaining({ lemma: 'γάτα', part_of_speech: 'noun' })
      );
    });

    // Toast shown immediately after approve
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringMatching(/saved|успешно/i) })
    );

    // Dialog stays open during audio generation (onWordLinked/close deferred to audio completion)
    expect(onWordLinked).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  // ============================================================
  // Approve & Save error flow (AC #16)
  // ============================================================

  // 55. On error: error toast shown, modal stays open
  it('shows error toast and keeps modal open when createAndLink fails', async () => {
    const mockCreateAndLink = vi.mocked(wordEntryAPI.createAndLink);
    mockCreateAndLink.mockRejectedValueOnce(new Error('Network error'));
    const mockToast = vi.mocked(toast);

    const onWordLinked = vi.fn();
    const onOpenChange = vi.fn();
    const user = userEvent.setup();

    renderDialog({ onWordLinked, onOpenChange });

    await submitWord(user);
    fireFullPipelineEvents();

    await waitFor(() => {
      expect(screen.getByTestId('approve-save-button')).not.toBeDisabled();
    });

    await user.click(screen.getByTestId('approve-save-button'));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
    });

    // Modal remains open (onOpenChange NOT called with false)
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    // onWordLinked must NOT be called on error (AC #8)
    expect(onWordLinked).not.toHaveBeenCalled();
  });

  // ============================================================
  // Start Over resets editable fields + selectionMap (AC #17)
  // ============================================================

  // 56. Start Over resets to input form
  it('Start Over resets to input form and clears all results', async () => {
    const user = userEvent.setup();
    renderDialog();

    await submitWord(user);
    fireFullPipelineEvents();

    await waitFor(() => {
      expect(screen.getByTestId('approve-save-button')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('generate-noun-start-over'));

    // Back to input form — verification and approve button not visible
    expect(screen.queryByTestId('approve-save-button')).not.toBeInTheDocument();
    expect(screen.getByTestId('generate-noun-input')).toBeInTheDocument();
    expect(screen.getByTestId('generate-noun-input')).toHaveValue('');
  });

  // 57. Unresolved warning NOT shown when all cross-AI comparisons agree (AC #10)
  it('does not show unresolved warning when all fields agree', async () => {
    const user = userEvent.setup();
    renderDialog();

    await submitWord(user);
    fireFullPipelineEvents();

    await waitFor(() => {
      expect(screen.getByTestId('approve-save-button')).toBeInTheDocument();
    });

    // mockVerificationData has cross_ai: null so no disagreements
    expect(screen.queryByTestId('unresolved-warning')).not.toBeInTheDocument();
  });

  // 59. Loading spinner shown on Approve & Save button while saving (AC #10)
  it('shows loading spinner on Approve & Save button while saving', async () => {
    vi.mocked(wordEntryAPI.createAndLink).mockImplementation(() => new Promise(() => {}));

    const user = userEvent.setup();
    renderDialog();

    await submitWord(user);
    fireFullPipelineEvents();

    await waitFor(() => {
      expect(screen.getByTestId('approve-save-button')).not.toBeDisabled();
    });

    await user.click(screen.getByTestId('approve-save-button'));

    const approveButton = screen.getByTestId('approve-save-button');
    expect(approveButton).toBeDisabled();
    expect(approveButton.querySelector('svg')).toBeTruthy();
  });
});

describe('Reverse Lookup Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedOnEvent = undefined;
    capturedOnError = undefined;
    vi.mocked(adminAPI.reverseLookup).mockResolvedValue({
      query: 'cat',
      language: 'en',
      results: mockReverseLookupResults,
    });
  });

  it('triggers reverse lookup when Latin text is submitted', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.type(screen.getByTestId('generate-noun-input'), 'cat');
    await user.click(screen.getByTestId('generate-noun-submit'));
    await waitFor(() => {
      expect(vi.mocked(adminAPI.reverseLookup)).toHaveBeenCalledWith('cat', 'en');
    });
  });

  it('triggers reverse lookup with lang=ru for Cyrillic text', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.type(screen.getByTestId('generate-noun-input'), 'кошка');
    await user.click(screen.getByTestId('generate-noun-submit'));
    await waitFor(() => {
      expect(vi.mocked(adminAPI.reverseLookup)).toHaveBeenCalledWith('кошка', 'ru');
    });
  });

  it('shows reverse lookup card with results after lookup', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.type(screen.getByTestId('generate-noun-input'), 'cat');
    await user.click(screen.getByTestId('generate-noun-submit'));
    await waitFor(() => {
      expect(screen.getByTestId('reverse-lookup-card')).toBeInTheDocument();
    });
    expect(screen.getByTestId('reverse-lookup-row-0')).toBeInTheDocument();
    expect(screen.getByTestId('reverse-lookup-row-1')).toBeInTheDocument();
  });

  it('shows best match badge on top-scoring result', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.type(screen.getByTestId('generate-noun-input'), 'cat');
    await user.click(screen.getByTestId('generate-noun-submit'));
    await waitFor(() => {
      expect(screen.getByTestId('reverse-lookup-card')).toBeInTheDocument();
    });
    // γάτα has score=3.0 (highest) → should show "Best match" badge
    const row0 = screen.getByTestId('reverse-lookup-row-0');
    expect(row0).toHaveTextContent('Best match');
    // γατί has score=2.0 → should not show badge
    const row1 = screen.getByTestId('reverse-lookup-row-1');
    expect(row1).not.toHaveTextContent('Best match');
  });

  it('shows best match badge on multiple results with same top score', async () => {
    vi.mocked(adminAPI.reverseLookup).mockResolvedValue({
      query: 'cat',
      language: 'en',
      results: [
        {
          lemma: 'γάτα',
          pos: 'NOUN',
          gender: 'feminine',
          article: 'η',
          translations: ['cat', 'kitty'],
          score: 3.0,
          inferred_gender: false,
        },
        {
          lemma: 'γατί',
          pos: 'NOUN',
          gender: 'neuter',
          article: 'το',
          translations: ['kitten'],
          score: 3.0,
          inferred_gender: false,
        },
      ],
    });
    const user = userEvent.setup();
    renderDialog();
    await user.type(screen.getByTestId('generate-noun-input'), 'cat');
    await user.click(screen.getByTestId('generate-noun-submit'));
    await waitFor(() => {
      expect(screen.getByTestId('reverse-lookup-card')).toBeInTheDocument();
    });
    // Both have score=3.0 → both should show badge
    expect(screen.getByTestId('reverse-lookup-row-0')).toHaveTextContent('Best match');
    expect(screen.getByTestId('reverse-lookup-row-1')).toHaveTextContent('Best match');
  });

  it('shows inferred gender with reduced opacity', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.type(screen.getByTestId('generate-noun-input'), 'cat');
    await user.click(screen.getByTestId('generate-noun-submit'));
    await waitFor(() => {
      expect(screen.getByTestId('reverse-lookup-card')).toBeInTheDocument();
    });
    // γατί has inferred_gender=true → gender badge should have opacity-70 class
    const row1 = screen.getByTestId('reverse-lookup-row-1');
    // Find the gender badge (secondary variant)
    const genderBadges = row1.querySelectorAll('[class*="opacity-70"]');
    expect(genderBadges.length).toBeGreaterThan(0);
    // Badge should also have title attribute
    const badgeWithTitle = Array.from(row1.querySelectorAll('[title]')).find(
      (el) => el.getAttribute('title') !== null
    );
    expect(badgeWithTitle).toBeTruthy();
    // γάτα has inferred_gender=false → no opacity-70 on gender badge
    const row0 = screen.getByTestId('reverse-lookup-row-0');
    expect(row0.querySelectorAll('[class*="opacity-70"]').length).toBe(0);
  });

  it('"Use selected" is disabled when no row is selected', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.type(screen.getByTestId('generate-noun-input'), 'cat');
    await user.click(screen.getByTestId('generate-noun-submit'));
    await waitFor(() => {
      expect(screen.getByTestId('reverse-lookup-card')).toBeInTheDocument();
    });
    expect(screen.getByTestId('reverse-lookup-use')).toBeDisabled();
  });

  it('Cancel clears reverse lookup results', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.type(screen.getByTestId('generate-noun-input'), 'cat');
    await user.click(screen.getByTestId('generate-noun-submit'));
    await waitFor(() => {
      expect(screen.getByTestId('reverse-lookup-card')).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('reverse-lookup-cancel'));
    expect(screen.queryByTestId('reverse-lookup-card')).not.toBeInTheDocument();
  });

  it('shows no-results message when lookup returns empty', async () => {
    vi.mocked(adminAPI.reverseLookup).mockResolvedValue({
      query: 'xyz',
      language: 'en',
      results: [],
    });
    const user = userEvent.setup();
    renderDialog();
    await user.type(screen.getByTestId('generate-noun-input'), 'xyz');
    await user.click(screen.getByTestId('generate-noun-submit'));
    await waitFor(() => {
      expect(screen.getByTestId('reverse-lookup-card')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('reverse-lookup-row-0')).not.toBeInTheDocument();
  });

  it('does not trigger reverse lookup for valid Greek input', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.type(screen.getByTestId('generate-noun-input'), 'γάτα');
    await user.click(screen.getByTestId('generate-noun-submit'));
    await waitFor(() => {
      expect(capturedOnEvent).toBeDefined();
    });
    expect(vi.mocked(adminAPI.reverseLookup)).not.toHaveBeenCalled();
  });

  it('does not trigger reverse lookup for tooLong input', async () => {
    const user = userEvent.setup();
    renderDialog();
    // Use Greek chars to hit the tooLong branch (Latin hits 'latin' branch before tooLong)
    const longGreek = 'α'.repeat(51);
    await user.type(screen.getByTestId('generate-noun-input'), longGreek);
    await user.click(screen.getByTestId('generate-noun-submit'));
    expect(vi.mocked(adminAPI.reverseLookup)).not.toHaveBeenCalled();
    expect(screen.getByTestId('generate-noun-warning')).toBeInTheDocument();
  });
});

describe('Double-Click on Lookup Row', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedOnEvent = undefined;
    capturedOnError = undefined;
    vi.mocked(adminAPI.reverseLookup).mockResolvedValue({
      query: 'cat',
      language: 'en',
      results: mockReverseLookupResults,
    });
  });

  it('double-click on row triggers pipeline', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.type(screen.getByTestId('generate-noun-input'), 'cat');
    await user.click(screen.getByTestId('generate-noun-submit'));
    await waitFor(() => {
      expect(screen.getByTestId('reverse-lookup-card')).toBeInTheDocument();
    });
    await user.dblClick(screen.getByTestId('reverse-lookup-row-0'));
    await waitFor(() => {
      expect(screen.queryByTestId('reverse-lookup-card')).not.toBeInTheDocument();
    });
  });
});

describe('Mixed-Script Warning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedOnEvent = undefined;
    capturedOnError = undefined;
  });

  it('shows warning for Greek + Latin mixed input', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.type(screen.getByTestId('generate-noun-input'), 'σπίτι house');
    expect(screen.getByTestId('generate-noun-warning')).toBeInTheDocument();
    expect(screen.getByTestId('generate-noun-submit')).toBeDisabled();
    expect(vi.mocked(adminAPI.reverseLookup)).not.toHaveBeenCalled();
  });

  it('shows warning for Greek + Cyrillic mixed input', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.type(screen.getByTestId('generate-noun-input'), 'σπίτι дом');
    expect(screen.getByTestId('generate-noun-warning')).toBeInTheDocument();
    expect(screen.getByTestId('generate-noun-submit')).toBeDisabled();
  });

  it('pure Greek input does not show mixed-script warning', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.type(screen.getByTestId('generate-noun-input'), 'γάτα');
    expect(screen.queryByTestId('generate-noun-warning')).not.toBeInTheDocument();
  });
});
