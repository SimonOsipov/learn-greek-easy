/**
 * GenerateNounDialog Component Tests
 *
 * Tests for the GenerateNounDialog component covering:
 * - Modal open/close states
 * - Greek input validation (valid, Latin, mixed, empty)
 * - Real useMutation API integration (loading, success, error states)
 * - Normalization result display (lemma, gender, POS, confidence badge)
 * - Start Over / Continue footer actions
 *
 * Related feature: [NGEN-08] Generate Noun Dialog
 */

import React from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { adminAPI } from '@/services/adminAPI';
import { APIRequestError } from '@/services/api';

import { GenerateNounDialog, type GenerateNounDialogProps } from '../GenerateNounDialog';

// ============================================
// Mocks
// ============================================

vi.mock('@/services/adminAPI', () => ({
  adminAPI: {
    generateWordEntry: vi.fn(),
  },
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

const mockNormalizationResponse = (
  overrides?: Partial<{
    confidence: number;
    confidence_tier: string;
    gender: string | null;
    article: string | null;
    corrected_from: string | null;
    corrected_to: string | null;
    strategy: string | null;
    suggestions: Array<{
      lemma: string;
      pos: string;
      gender: string | null;
      article: string | null;
      confidence: number;
      confidence_tier: string;
      strategy: string;
    }>;
    duplicate_check: {
      is_duplicate: boolean;
      existing_entry: {
        id: string;
        lemma: string;
        part_of_speech: string;
        translation_en: string;
        translation_ru: string | null;
        pronunciation: string | null;
      } | null;
      matched_deck_id: string | null;
      matched_deck_name: string | null;
    } | null;
  }>
) => ({
  stage: 'duplicate_check',
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
  duplicate_check:
    overrides?.duplicate_check !== undefined
      ? overrides.duplicate_check
      : {
          is_duplicate: false,
          existing_entry: null,
          matched_deck_id: null,
          matched_deck_name: null,
        },
  generation: null,
  local_verification: null,
  cross_verification: null,
  persist: null,
});

// ============================================
// Tests
// ============================================

describe('GenerateNounDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  // 5. Latin input shows warning
  it('shows warning and disables Create for Latin input', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.type(screen.getByTestId('generate-noun-input'), 'spiti');

    expect(screen.getByTestId('generate-noun-warning')).toBeInTheDocument();
    expect(screen.getByTestId('generate-noun-submit')).toBeDisabled();
  });

  // 6. Mixed input shows warning
  it('shows warning and disables Create for mixed Greek/Latin input', async () => {
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

  // 8. Submit shows loading spinner
  it('shows loading spinner after clicking Create', async () => {
    const user = userEvent.setup();
    vi.mocked(adminAPI.generateWordEntry).mockReturnValue(new Promise(() => {}));
    renderDialog();

    await user.type(screen.getByTestId('generate-noun-input'), 'σπίτι');
    await user.click(screen.getByTestId('generate-noun-submit'));

    expect(screen.getByTestId('generate-noun-submit')).toBeDisabled();
    // The Loader2 spinner is present (Creating... text from i18n key fallback)
    const submitBtn = screen.getByTestId('generate-noun-submit');
    expect(submitBtn.querySelector('svg')).toBeTruthy();
  });

  // 9. Input disabled during loading
  it('disables input during loading', async () => {
    const user = userEvent.setup();
    vi.mocked(adminAPI.generateWordEntry).mockReturnValue(new Promise(() => {}));
    renderDialog();

    await user.type(screen.getByTestId('generate-noun-input'), 'σπίτι');
    await user.click(screen.getByTestId('generate-noun-submit'));

    expect(screen.getByTestId('generate-noun-input')).toBeDisabled();
  });

  // 10. Result card displayed on success
  it('displays normalization result card on success', async () => {
    const user = userEvent.setup();
    vi.mocked(adminAPI.generateWordEntry).mockResolvedValue(mockNormalizationResponse());
    renderDialog();

    await user.type(screen.getByTestId('generate-noun-input'), 'γάτα');
    await user.click(screen.getByTestId('generate-noun-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('generate-noun-result')).toBeInTheDocument();
    });
  });

  // 11. Lemma displayed correctly
  it('shows lemma in result', async () => {
    const user = userEvent.setup();
    vi.mocked(adminAPI.generateWordEntry).mockResolvedValue(mockNormalizationResponse());
    renderDialog();

    await user.type(screen.getByTestId('generate-noun-input'), 'γάτα');
    await user.click(screen.getByTestId('generate-noun-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('result-lemma')).toHaveTextContent('γάτα');
    });
  });

  // 12. Gender + article displayed
  it('shows gender with article in result', async () => {
    const user = userEvent.setup();
    vi.mocked(adminAPI.generateWordEntry).mockResolvedValue(mockNormalizationResponse());
    renderDialog();

    await user.type(screen.getByTestId('generate-noun-input'), 'γάτα');
    await user.click(screen.getByTestId('generate-noun-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('result-gender')).toHaveTextContent('feminine (η)');
    });
  });

  // 13. POS displayed
  it('shows POS in result', async () => {
    const user = userEvent.setup();
    vi.mocked(adminAPI.generateWordEntry).mockResolvedValue(mockNormalizationResponse());
    renderDialog();

    await user.type(screen.getByTestId('generate-noun-input'), 'γάτα');
    await user.click(screen.getByTestId('generate-noun-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('result-pos')).toHaveTextContent('NOUN');
    });
  });

  // 14. High confidence badge has green class
  it('shows high confidence badge with green class', async () => {
    const user = userEvent.setup();
    vi.mocked(adminAPI.generateWordEntry).mockResolvedValue(
      mockNormalizationResponse({ confidence: 0.9, confidence_tier: 'high' })
    );
    renderDialog();

    await user.type(screen.getByTestId('generate-noun-input'), 'γάτα');
    await user.click(screen.getByTestId('generate-noun-submit'));

    await waitFor(() => {
      const badge = screen.getByTestId('result-confidence-badge');
      expect(badge.className).toContain('bg-green-100');
    });
  });

  // 15. Medium confidence badge has amber class
  it('shows medium confidence badge with amber class', async () => {
    const user = userEvent.setup();
    vi.mocked(adminAPI.generateWordEntry).mockResolvedValue(
      mockNormalizationResponse({ confidence: 0.6, confidence_tier: 'medium' })
    );
    renderDialog();

    await user.type(screen.getByTestId('generate-noun-input'), 'γάτα');
    await user.click(screen.getByTestId('generate-noun-submit'));

    await waitFor(() => {
      const badge = screen.getByTestId('result-confidence-badge');
      expect(badge.className).toContain('bg-amber-100');
    });
  });

  // 16. Low confidence badge has red class
  it('shows low confidence badge with red class', async () => {
    const user = userEvent.setup();
    vi.mocked(adminAPI.generateWordEntry).mockResolvedValue(
      mockNormalizationResponse({ confidence: 0.2, confidence_tier: 'low' })
    );
    renderDialog();

    await user.type(screen.getByTestId('generate-noun-input'), 'γάτα');
    await user.click(screen.getByTestId('generate-noun-submit'));

    await waitFor(() => {
      const badge = screen.getByTestId('result-confidence-badge');
      expect(badge.className).toContain('bg-red-100');
    });
  });

  // 17. Badge shows numeric score and tier label
  it('shows confidence score and tier label in badge', async () => {
    const user = userEvent.setup();
    vi.mocked(adminAPI.generateWordEntry).mockResolvedValue(
      mockNormalizationResponse({ confidence: 1.0, confidence_tier: 'high' })
    );
    renderDialog();

    await user.type(screen.getByTestId('generate-noun-input'), 'γάτα');
    await user.click(screen.getByTestId('generate-noun-submit'));

    await waitFor(() => {
      const badge = screen.getByTestId('result-confidence-badge');
      expect(badge.textContent).toContain('1.00');
    });
  });

  // 18. Low confidence warning shown when tier is low
  it('shows low confidence warning when tier is low', async () => {
    const user = userEvent.setup();
    vi.mocked(adminAPI.generateWordEntry).mockResolvedValue(
      mockNormalizationResponse({ confidence: 0.2, confidence_tier: 'low' })
    );
    renderDialog();

    await user.type(screen.getByTestId('generate-noun-input'), 'γάτα');
    await user.click(screen.getByTestId('generate-noun-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('result-low-confidence-warning')).toBeInTheDocument();
    });
  });

  // 19. Low confidence warning hidden when tier is high
  it('hides low confidence warning when tier is high', async () => {
    const user = userEvent.setup();
    vi.mocked(adminAPI.generateWordEntry).mockResolvedValue(
      mockNormalizationResponse({ confidence: 1.0, confidence_tier: 'high' })
    );
    renderDialog();

    await user.type(screen.getByTestId('generate-noun-input'), 'γάτα');
    await user.click(screen.getByTestId('generate-noun-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('generate-noun-result')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('result-low-confidence-warning')).not.toBeInTheDocument();
  });

  // 20. Error alert on API error
  it('shows error alert on API error', async () => {
    const user = userEvent.setup();
    vi.mocked(adminAPI.generateWordEntry).mockRejectedValue(
      new APIRequestError({
        status: 404,
        statusText: 'Not Found',
        message: 'Active deck not found',
        detail: 'Active deck not found',
      })
    );
    renderDialog();

    await user.type(screen.getByTestId('generate-noun-input'), 'γάτα');
    await user.click(screen.getByTestId('generate-noun-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('generate-noun-error')).toBeInTheDocument();
    });

    expect(screen.getByTestId('generate-noun-error')).toHaveTextContent('Active deck not found');
  });

  // 21. Error clears when input changes
  it('clears error when input changes', async () => {
    const user = userEvent.setup();
    vi.mocked(adminAPI.generateWordEntry).mockRejectedValue(
      new APIRequestError({
        status: 404,
        statusText: 'Not Found',
        message: 'Active deck not found',
        detail: 'Active deck not found',
      })
    );
    renderDialog();

    await user.type(screen.getByTestId('generate-noun-input'), 'γάτα');
    await user.click(screen.getByTestId('generate-noun-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('generate-noun-error')).toBeInTheDocument();
    });

    await user.type(screen.getByTestId('generate-noun-input'), 'α');

    expect(screen.queryByTestId('generate-noun-error')).not.toBeInTheDocument();
  });

  // 22. Start Over resets to input state
  it('Start Over resets to input state after result', async () => {
    const user = userEvent.setup();
    vi.mocked(adminAPI.generateWordEntry).mockResolvedValue(mockNormalizationResponse());
    renderDialog();

    await user.type(screen.getByTestId('generate-noun-input'), 'γάτα');
    await user.click(screen.getByTestId('generate-noun-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('generate-noun-result')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('generate-noun-start-over'));

    expect(screen.queryByTestId('generate-noun-result')).not.toBeInTheDocument();
    expect(screen.getByTestId('generate-noun-input')).toBeInTheDocument();
    expect(screen.getByTestId('generate-noun-input')).toHaveValue('');
  });

  // 23. Create button enabled after error (retry)
  it('Create button remains enabled after error for retry', async () => {
    const user = userEvent.setup();
    vi.mocked(adminAPI.generateWordEntry).mockRejectedValue(
      new APIRequestError({
        status: 404,
        statusText: 'Not Found',
        message: 'Active deck not found',
        detail: 'Active deck not found',
      })
    );
    renderDialog();
    const input = screen.getByTestId('generate-noun-input');
    await user.type(input, 'γάτα');
    await user.click(screen.getByTestId('generate-noun-submit'));
    await waitFor(() => {
      expect(screen.getByTestId('generate-noun-error')).toBeInTheDocument();
    });
    expect(screen.getByTestId('generate-noun-submit')).not.toBeDisabled();
  });

  // 24. Continue button is enabled after duplicate check
  it('Continue button is enabled after duplicate check completes', async () => {
    const user = userEvent.setup();
    vi.mocked(adminAPI.generateWordEntry).mockResolvedValue(mockNormalizationResponse());
    renderDialog();
    const input = screen.getByTestId('generate-noun-input');
    await user.type(input, 'γάτα');
    await user.click(screen.getByTestId('generate-noun-submit'));
    await waitFor(() => {
      expect(screen.getByTestId('generate-noun-result')).toBeInTheDocument();
    });
    expect(screen.getByTestId('generate-noun-continue')).not.toBeDisabled();
  });

  // 25. No correction note when corrected_from is null
  it('does not show correction note when corrected_from is null', async () => {
    const user = userEvent.setup();
    vi.mocked(adminAPI.generateWordEntry).mockResolvedValue(mockNormalizationResponse());
    renderDialog();

    await user.type(screen.getByTestId('generate-noun-input'), 'γάτα');
    await user.click(screen.getByTestId('generate-noun-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('generate-noun-result')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('correction-note')).not.toBeInTheDocument();
  });

  // 26. Shows correction note when corrected_from and corrected_to are set
  it('shows correction note when corrected_from and corrected_to are set', async () => {
    const user = userEvent.setup();
    vi.mocked(adminAPI.generateWordEntry).mockResolvedValue(
      mockNormalizationResponse({ corrected_from: 'σπιτι', corrected_to: 'σπίτι' })
    );
    renderDialog();

    await user.type(screen.getByTestId('generate-noun-input'), 'σπιτι');
    await user.click(screen.getByTestId('generate-noun-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('correction-note')).toBeInTheDocument();
    });

    expect(screen.getByTestId('correction-note')).toHaveTextContent('σπιτι');
  });

  // 27. No suggestions section when suggestions is empty
  it('does not show suggestions section when suggestions is empty', async () => {
    const user = userEvent.setup();
    vi.mocked(adminAPI.generateWordEntry).mockResolvedValue(mockNormalizationResponse());
    renderDialog();

    await user.type(screen.getByTestId('generate-noun-input'), 'γάτα');
    await user.click(screen.getByTestId('generate-noun-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('generate-noun-result')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('suggestions-section')).not.toBeInTheDocument();
  });

  // 28. Renders suggestion rows
  it('renders suggestion rows when suggestions are provided', async () => {
    const user = userEvent.setup();
    vi.mocked(adminAPI.generateWordEntry).mockResolvedValue(
      mockNormalizationResponse({
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
      })
    );
    renderDialog();

    await user.type(screen.getByTestId('generate-noun-input'), 'γάτα');
    await user.click(screen.getByTestId('generate-noun-submit'));

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
    vi.mocked(adminAPI.generateWordEntry).mockResolvedValue(
      mockNormalizationResponse({
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
      })
    );
    renderDialog();

    await user.type(screen.getByTestId('generate-noun-input'), 'γάτα');
    await user.click(screen.getByTestId('generate-noun-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('suggestion-row-0')).toBeInTheDocument();
    });

    // Before swap: primary is γάτα, suggestion is γάτος
    expect(screen.getByTestId('result-lemma')).toHaveTextContent('γάτα');

    await user.click(screen.getByTestId('suggestion-use-0'));

    // After swap: primary should be γάτος
    expect(screen.getByTestId('result-lemma')).toHaveTextContent('γάτος');
    // Old primary (γάτα) should now be in suggestion row
    expect(screen.getByTestId('suggestion-row-0')).toHaveTextContent('γάτα');
  });

  // 30. Round-trip swap — swap A→B→A returns to original
  it('round-trip swap returns to original values', async () => {
    const user = userEvent.setup();
    vi.mocked(adminAPI.generateWordEntry).mockResolvedValue(
      mockNormalizationResponse({
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
      })
    );
    renderDialog();

    await user.type(screen.getByTestId('generate-noun-input'), 'γάτα');
    await user.click(screen.getByTestId('generate-noun-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('suggestion-row-0')).toBeInTheDocument();
    });

    // Swap A→B
    await user.click(screen.getByTestId('suggestion-use-0'));
    expect(screen.getByTestId('result-lemma')).toHaveTextContent('γάτος');

    // Swap B→A
    await user.click(screen.getByTestId('suggestion-use-0'));
    expect(screen.getByTestId('result-lemma')).toHaveTextContent('γάτα');
    expect(screen.getByTestId('suggestion-row-0')).toHaveTextContent('γάτος');
  });

  // 31. No-duplicate banner shown
  it('shows no-duplicate banner when is_duplicate is false', async () => {
    const user = userEvent.setup();
    vi.mocked(adminAPI.generateWordEntry).mockResolvedValue(mockNormalizationResponse());
    renderDialog();

    await user.type(screen.getByTestId('generate-noun-input'), 'γάτα');
    await user.click(screen.getByTestId('generate-noun-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('no-duplicate-banner')).toBeInTheDocument();
    });
  });

  // 32. Duplicate found warning shown
  it('shows duplicate warning when is_duplicate is true', async () => {
    const user = userEvent.setup();
    vi.mocked(adminAPI.generateWordEntry).mockResolvedValue(
      mockNormalizationResponse({
        duplicate_check: {
          is_duplicate: true,
          existing_entry: {
            id: 'entry-1',
            lemma: 'γάτα',
            part_of_speech: 'NOUN',
            translation_en: 'cat',
            translation_ru: null,
            pronunciation: null,
          },
          matched_deck_id: 'deck-2',
          matched_deck_name: 'Animals',
        },
      })
    );
    renderDialog();

    await user.type(screen.getByTestId('generate-noun-input'), 'γάτα');
    await user.click(screen.getByTestId('generate-noun-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('duplicate-found-warning')).toBeInTheDocument();
    });
    expect(screen.getByTestId('duplicate-found-warning')).toHaveTextContent('Animals');
    expect(screen.getByTestId('duplicate-found-warning')).toHaveTextContent('cat');
  });

  // 33. Continue button enabled even when duplicate found
  it('Continue button is enabled even when duplicate found', async () => {
    const user = userEvent.setup();
    vi.mocked(adminAPI.generateWordEntry).mockResolvedValue(
      mockNormalizationResponse({
        duplicate_check: {
          is_duplicate: true,
          existing_entry: {
            id: 'entry-1',
            lemma: 'γάτα',
            part_of_speech: 'NOUN',
            translation_en: 'cat',
            translation_ru: null,
            pronunciation: null,
          },
          matched_deck_id: 'deck-2',
          matched_deck_name: 'Animals',
        },
      })
    );
    renderDialog();

    await user.type(screen.getByTestId('generate-noun-input'), 'γάτα');
    await user.click(screen.getByTestId('generate-noun-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('duplicate-found-warning')).toBeInTheDocument();
    });
    expect(screen.getByTestId('generate-noun-continue')).not.toBeDisabled();
  });

  // 34. Start Over clears swap state
  it('Start Over clears swap state and returns to input form', async () => {
    const user = userEvent.setup();
    vi.mocked(adminAPI.generateWordEntry).mockResolvedValue(
      mockNormalizationResponse({
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
      })
    );
    renderDialog();

    await user.type(screen.getByTestId('generate-noun-input'), 'γάτα');
    await user.click(screen.getByTestId('generate-noun-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('suggestion-row-0')).toBeInTheDocument();
    });

    // Swap
    await user.click(screen.getByTestId('suggestion-use-0'));
    expect(screen.getByTestId('result-lemma')).toHaveTextContent('γάτος');

    // Start Over
    await user.click(screen.getByTestId('generate-noun-start-over'));

    // Should be back at input form, not result
    expect(screen.queryByTestId('generate-noun-result')).not.toBeInTheDocument();
    expect(screen.getByTestId('generate-noun-input')).toBeInTheDocument();
    expect(screen.queryByTestId('suggestions-section')).not.toBeInTheDocument();
  });
});
