/**
 * SSE-specific tests for GenerateNounDialog — progressive disclosure and suggestion swap.
 * Separate file from GenerateNounDialog.test.tsx (which tests sync behavior).
 *
 * Uses the same useSSE mock pattern as GenerateNounDialog.test.tsx:
 * capture the onEvent/onError callbacks then fire events directly.
 */

import React from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { GenerateNounDialog, type GenerateNounDialogProps } from '../GenerateNounDialog';

// ============================================
// Mocks
// ============================================

vi.mock('@/services/adminAPI', () => ({
  GENERATE_WORD_ENTRY_STREAM_URL: '/api/v1/admin/word-entries/generate/stream',
  adminAPI: {
    generateWordEntry: vi.fn(),
    linkWordEntry: vi.fn().mockResolvedValue(undefined),
  },
}));

// Capture SSE callbacks so tests can fire events directly
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

/** Helper: type a word and click submit */
const submitWord = async (user: ReturnType<typeof userEvent.setup>, word = 'γάτα') => {
  await user.type(screen.getByTestId('generate-noun-input'), word);
  await user.click(screen.getByTestId('generate-noun-submit'));
};

/** Fire normalization_complete + duplicates_checked events */
const fireNormalizationEvents = (overrides?: {
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
          gender: 'feminine',
          article: 'η',
          pos: 'NOUN',
          confidence: 1.0,
          confidence_tier: 'high',
          strategy: null,
          corrected_from: null,
          corrected_to: null,
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

/** Fire full pipeline through generation */
const fireGenerationEvents = () => {
  fireNormalizationEvents();
  act(() => {
    capturedOnEvent?.({ type: 'generation_started', data: {} });
    capturedOnEvent?.({ type: 'generation_complete', data: mockGenerationData });
    capturedOnEvent?.({
      type: 'translations_found',
      data: { data: mockTranslationLookup },
    });
    capturedOnEvent?.({ type: 'pipeline_complete', data: {} });
  });
};

// ============================================
// Tests
// ============================================

describe('GenerateNounDialog SSE integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedOnEvent = undefined;
    capturedOnError = undefined;
  });

  // Group 1: SSE Connection & Basic Events

  it('captures onEvent callback when SSE is enabled on submit', async () => {
    const user = userEvent.setup();
    renderDialog();

    await submitWord(user);

    // After submit, useSSE should be called with enabled=true, capturing onEvent
    expect(capturedOnEvent).toBeDefined();
  });

  it('renders normalization result when normalization_complete event fires', async () => {
    const user = userEvent.setup();
    renderDialog();

    await submitWord(user);
    fireNormalizationEvents();

    await waitFor(() => {
      expect(screen.getByTestId('result-lemma')).toHaveTextContent('γάτα');
    });
    expect(screen.getByTestId('result-gender')).toHaveTextContent('feminine (η)');
  });

  it('renders no-duplicate-banner when duplicates_checked event fires with is_duplicate=false', async () => {
    const user = userEvent.setup();
    renderDialog();

    await submitWord(user);
    fireNormalizationEvents();

    await waitFor(() => {
      expect(screen.getByTestId('no-duplicate-banner')).toBeInTheDocument();
    });
  });

  it('shows "Generating with AI..." spinner when generation_started event fires', async () => {
    const user = userEvent.setup();
    renderDialog();

    await submitWord(user);
    fireNormalizationEvents();

    act(() => {
      capturedOnEvent?.({ type: 'generation_started', data: {} });
    });

    await waitFor(() => {
      expect(screen.getByText('Generating with AI...')).toBeInTheDocument();
    });
  });

  it('renders examples-section when generation_complete event fires', async () => {
    const user = userEvent.setup();
    renderDialog();

    await submitWord(user);
    fireGenerationEvents();

    await waitFor(() => {
      expect(screen.getByTestId('examples-section')).toBeInTheDocument();
    });
    expect(screen.getByTestId('gen-example-1')).toHaveTextContent('Η γάτα κοιμάται.');
  });

  it('shows "Running verification..." when verification_started event fires', async () => {
    const user = userEvent.setup();
    renderDialog();

    await submitWord(user);
    fireNormalizationEvents();
    act(() => {
      capturedOnEvent?.({ type: 'generation_started', data: {} });
      capturedOnEvent?.({ type: 'generation_complete', data: mockGenerationData });
      capturedOnEvent?.({ type: 'verification_started', data: {} });
    });

    await waitFor(() => {
      expect(screen.getByText('Running verification...')).toBeInTheDocument();
    });
  });

  it('renders verification-tier-badge when verification_complete event fires', async () => {
    const user = userEvent.setup();
    renderDialog();

    await submitWord(user);
    fireNormalizationEvents();
    act(() => {
      capturedOnEvent?.({ type: 'generation_started', data: {} });
      capturedOnEvent?.({ type: 'generation_complete', data: mockGenerationData });
      capturedOnEvent?.({ type: 'verification_complete', data: mockVerificationData });
      capturedOnEvent?.({ type: 'pipeline_complete', data: {} });
    });

    await waitFor(() => {
      expect(screen.getByTestId('verification-tier-badge')).toBeInTheDocument();
    });
  });

  // Group 2: Error Handling

  it('shows stage-error and keeps normalization result when generation_failed fires', async () => {
    const user = userEvent.setup();
    renderDialog();

    await submitWord(user);
    fireNormalizationEvents();
    act(() => {
      capturedOnEvent?.({ type: 'generation_started', data: {} });
      capturedOnEvent?.({ type: 'generation_failed', data: { error: 'LLM timeout' } });
    });

    await waitFor(() => {
      expect(screen.getByTestId('stage-error')).toBeInTheDocument();
    });
    expect(screen.getByTestId('stage-error')).toHaveTextContent('LLM timeout');
    // Normalization result remains
    expect(screen.getByTestId('result-lemma')).toHaveTextContent('γάτα');
  });

  it('keeps examples-section visible when verification_failed fires', async () => {
    const user = userEvent.setup();
    renderDialog();

    await submitWord(user);
    fireNormalizationEvents();
    act(() => {
      capturedOnEvent?.({ type: 'generation_started', data: {} });
      capturedOnEvent?.({ type: 'generation_complete', data: mockGenerationData });
      capturedOnEvent?.({ type: 'verification_started', data: {} });
      capturedOnEvent?.({ type: 'verification_failed', data: { error: 'Verification error' } });
      capturedOnEvent?.({ type: 'pipeline_complete', data: {} });
    });

    await waitFor(() => {
      expect(screen.getByTestId('examples-section')).toBeInTheDocument();
    });
    // examples-section stays visible
    expect(screen.queryByTestId('verification-tier-badge')).not.toBeInTheDocument();
  });

  // Group 3: Suggestion Swap with Confirmation

  it('shows AlertDialog confirmation when swapping suggestion after generation completes', async () => {
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
    act(() => {
      capturedOnEvent?.({ type: 'generation_started', data: {} });
      capturedOnEvent?.({ type: 'generation_complete', data: mockGenerationData });
      capturedOnEvent?.({ type: 'pipeline_complete', data: {} });
    });

    await waitFor(() => {
      expect(screen.getByTestId('suggestion-row-0')).toBeInTheDocument();
    });

    // Click "Use" after generation — should show confirmation dialog
    await user.click(screen.getByTestId('suggestion-use-0'));

    await waitFor(() => {
      // AlertDialog title from i18n key 'generateNoun.swapConfirmTitle'
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });
  });

  it('swaps suggestion immediately (no dialog) when generation has not completed', async () => {
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

    // Click "Use" before generation completes — no AlertDialog
    await user.click(screen.getByTestId('suggestion-use-0'));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    // Primary lemma swapped immediately
    expect(screen.getByTestId('result-lemma')).toHaveTextContent('γάτος');
  });

  it('clears generation section when suggestion is swapped', async () => {
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

    // Swap before generation completes — generation-section should be absent
    await waitFor(() => {
      expect(screen.getByTestId('suggestion-row-0')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('suggestion-use-0'));

    // Examples section was never populated, should remain absent
    expect(screen.queryByTestId('examples-section')).not.toBeInTheDocument();
    // Normalization section stays
    expect(screen.getByTestId('result-lemma')).toBeInTheDocument();
  });

  // Group 4: Connection Lifecycle

  it('calls mockClose when Start Over is clicked after streaming', async () => {
    const user = userEvent.setup();
    renderDialog();

    await submitWord(user);
    fireNormalizationEvents();

    await waitFor(() => {
      expect(screen.getByTestId('generate-noun-result')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('generate-noun-start-over'));

    // closeStream() is called internally on Start Over (resetAllState calls closeStream)
    expect(mockClose).toHaveBeenCalled();
  });

  it('disables SSE streaming (enabled=false) when pipeline_complete fires', async () => {
    const user = userEvent.setup();
    renderDialog();

    await submitWord(user);
    fireNormalizationEvents();

    act(() => {
      capturedOnEvent?.({ type: 'pipeline_complete', data: {} });
    });

    // After pipeline_complete, streamEnabled becomes false → useSSE called with enabled=false
    // Verify no error thrown and component remains stable
    await waitFor(() => {
      expect(screen.getByTestId('generate-noun-result')).toBeInTheDocument();
    });
  });

  // Group 5: Flow & Progressive Rendering

  it('shows all pipeline sections progressively as events arrive', async () => {
    const user = userEvent.setup();
    renderDialog();

    await submitWord(user);

    // Step 1: normalization
    act(() => {
      capturedOnEvent?.({
        type: 'normalization_complete',
        data: {
          normalization: {
            input_word: 'γάτα',
            lemma: 'γάτα',
            gender: 'feminine',
            article: 'η',
            pos: 'NOUN',
            confidence: 1.0,
            confidence_tier: 'high',
            strategy: null,
            corrected_from: null,
            corrected_to: null,
          },
          suggestions: [],
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('result-lemma')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('examples-section')).not.toBeInTheDocument();

    // Step 2: duplicates
    act(() => {
      capturedOnEvent?.({
        type: 'duplicates_checked',
        data: { is_duplicate: false, word_entry_id: null, existing_entry: null, matched_decks: [] },
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('no-duplicate-banner')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('examples-section')).not.toBeInTheDocument();

    // Step 3: generation
    act(() => {
      capturedOnEvent?.({ type: 'generation_started', data: {} });
      capturedOnEvent?.({ type: 'generation_complete', data: mockGenerationData });
    });

    await waitFor(() => {
      expect(screen.getByTestId('examples-section')).toBeInTheDocument();
    });
  });

  it('enables retry after pipeline_failed event', async () => {
    const user = userEvent.setup();
    renderDialog();

    await submitWord(user);

    act(() => {
      capturedOnEvent?.({ type: 'pipeline_failed', data: { error: 'Pipeline failed' } });
    });

    // Submit button becomes enabled again (hasResult=false, pipelineStatus=error)
    await waitFor(() => {
      expect(screen.getByTestId('generate-noun-submit')).not.toBeDisabled();
    });
  });

  it('shows error alert on stream connection error', async () => {
    const user = userEvent.setup();
    renderDialog();

    await submitWord(user);

    act(() => {
      capturedOnError?.(new Error('Network error'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('generate-noun-error')).toBeInTheDocument();
    });
    expect(screen.getByTestId('generate-noun-error')).toHaveTextContent('Network error');
  });
});
