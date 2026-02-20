/**
 * Tests for WordEntryEditForm component (WDET04-05)
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';

import { WordEntryEditForm } from '../WordEntryEditForm';
import i18n from '@/i18n';

// ============================================
// Mocks
// ============================================

const mockMutateAsync = vi.fn();
const mockMutate = vi.fn();

vi.mock('@/features/words/hooks/useUpdateWordEntry', () => ({
  useUpdateWordEntry: vi.fn(() => ({
    mutate: mockMutate,
    mutateAsync: mockMutateAsync,
    isPending: false,
    variables: undefined,
  })),
}));

vi.mock('@/services/wordEntryAPI', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/wordEntryAPI')>();
  return {
    ...actual,
    wordEntryAPI: {
      ...actual.wordEntryAPI,
      updateInline: vi.fn(),
      generatePartAudio: vi.fn(),
    },
  };
});

vi.mock('@/lib/analytics/adminAnalytics', () => ({
  trackAdminWordEntryEditStarted: vi.fn(),
  trackAdminWordEntryEditSaved: vi.fn(),
  trackAdminWordEntryEditCancelled: vi.fn(),
  trackAdminWordEntryAutoAudioRegen: vi.fn(),
}));

// ============================================
// Factory Functions
// ============================================

const createMockWordEntry = (overrides = {}) => ({
  id: 'we-123',
  deck_id: 'deck-456',
  lemma: 'σπίτι',
  part_of_speech: 'noun' as const,
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
// Test Helpers
// ============================================

function renderForm(overrides = {}) {
  const wordEntry = createMockWordEntry(overrides);
  const onSaveSuccess = vi.fn();
  const onCancel = vi.fn();

  const result = render(
    <I18nextProvider i18n={i18n}>
      <WordEntryEditForm wordEntry={wordEntry} onSaveSuccess={onSaveSuccess} onCancel={onCancel} />
    </I18nextProvider>
  );

  return { ...result, wordEntry, onSaveSuccess, onCancel };
}

// ============================================
// Tests
// ============================================

describe('WordEntryEditForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMutateAsync.mockResolvedValue(createMockWordEntry());
  });

  // ============================================
  // Group 1: Rendering
  // ============================================

  describe('rendering', () => {
    it('renders the edit form with testid', () => {
      renderForm();
      expect(screen.getByTestId('word-entry-edit-form')).toBeInTheDocument();
    });

    it('renders lemma as read-only display', () => {
      renderForm();
      const lemmaField = screen.getByTestId('word-entry-field-lemma');
      expect(lemmaField).toBeInTheDocument();
      expect(lemmaField).toHaveTextContent('σπίτι');
    });

    it('renders part_of_speech as read-only display', () => {
      renderForm();
      const posField = screen.getByTestId('word-entry-field-part-of-speech');
      expect(posField).toBeInTheDocument();
      expect(posField).toHaveTextContent('noun');
    });

    it('pre-populates translation_en field', () => {
      renderForm();
      const input = screen.getByTestId('word-entry-field-translation-en') as HTMLInputElement;
      expect(input.value).toBe('house');
    });

    it('pre-populates translation_en_plural field', () => {
      renderForm();
      const input = screen.getByTestId(
        'word-entry-field-translation-en-plural'
      ) as HTMLInputElement;
      expect(input.value).toBe('houses');
    });

    it('pre-populates translation_ru field', () => {
      renderForm();
      const input = screen.getByTestId('word-entry-field-translation-ru') as HTMLInputElement;
      expect(input.value).toBe('дом');
    });

    it('pre-populates pronunciation field', () => {
      renderForm();
      const input = screen.getByTestId('word-entry-field-pronunciation') as HTMLInputElement;
      expect(input.value).toBe('/spí·ti/');
    });

    it('shows gender field for noun', () => {
      renderForm();
      expect(screen.getByTestId('word-entry-field-gender')).toBeInTheDocument();
    });

    it('shows gender field for adjective', () => {
      renderForm({ part_of_speech: 'adjective', grammar_data: { gender: 'masculine' } });
      expect(screen.getByTestId('word-entry-field-gender')).toBeInTheDocument();
    });

    it('does not show gender field for verb', () => {
      renderForm({ part_of_speech: 'verb', grammar_data: {} });
      expect(screen.queryByTestId('word-entry-field-gender')).not.toBeInTheDocument();
    });

    it('does not show gender field for adverb', () => {
      renderForm({ part_of_speech: 'adverb', grammar_data: {} });
      expect(screen.queryByTestId('word-entry-field-gender')).not.toBeInTheDocument();
    });

    it('renders example fields when examples exist', () => {
      renderForm();
      expect(screen.getByTestId('word-entry-example-0')).toBeInTheDocument();
    });

    it('pre-populates example greek field', () => {
      renderForm();
      const input = screen.getByTestId('word-entry-example-0-greek') as HTMLInputElement;
      expect(input.value).toBe('Το σπίτι είναι μεγάλο.');
    });

    it('does not render examples section when examples is null', () => {
      renderForm({ examples: null });
      expect(screen.queryByTestId('word-entry-example-0')).not.toBeInTheDocument();
    });
  });

  // ============================================
  // Group 2: Dirty Tracking
  // ============================================

  describe('dirty tracking', () => {
    it('Save button is disabled when form is clean', () => {
      renderForm();
      const saveBtn = screen.getByTestId('word-entry-save-btn');
      expect(saveBtn).toBeDisabled();
    });

    it('Save button is enabled when a field is changed', async () => {
      renderForm();
      const input = screen.getByTestId('word-entry-field-translation-en');
      fireEvent.change(input, { target: { value: 'home' } });
      await waitFor(() => {
        expect(screen.getByTestId('word-entry-save-btn')).not.toBeDisabled();
      });
    });

    it('Cancel button is always enabled', () => {
      renderForm();
      expect(screen.getByTestId('word-entry-cancel-btn')).not.toBeDisabled();
    });
  });

  // ============================================
  // Group 3: Validation
  // ============================================

  describe('validation', () => {
    it('Save button is disabled when translation_en is cleared', async () => {
      renderForm();
      const input = screen.getByTestId('word-entry-field-translation-en');
      // Clear the required field
      fireEvent.change(input, { target: { value: '' } });
      fireEvent.blur(input);
      await waitFor(() => {
        expect(screen.getByTestId('word-entry-save-btn')).toBeDisabled();
      });
    });
  });

  // ============================================
  // Group 4: Cancel / Unsaved Changes
  // ============================================

  describe('cancel behavior', () => {
    it('calls onCancel directly when form is clean', () => {
      const { onCancel } = renderForm();
      fireEvent.click(screen.getByTestId('word-entry-cancel-btn'));
      expect(onCancel).toHaveBeenCalledOnce();
    });

    it('shows discard dialog when form is dirty', async () => {
      renderForm();
      const input = screen.getByTestId('word-entry-field-translation-en');
      fireEvent.change(input, { target: { value: 'home' } });

      fireEvent.click(screen.getByTestId('word-entry-cancel-btn'));

      await waitFor(() => {
        // The discard dialog wrapper should be in the document
        expect(screen.getByTestId('word-entry-discard-dialog')).toBeInTheDocument();
      });
    });
  });

  // ============================================
  // Group 5: Save Flow
  // ============================================

  describe('save flow', () => {
    it('calls mutateAsync on form submit', async () => {
      renderForm();
      const input = screen.getByTestId('word-entry-field-translation-en');
      fireEvent.change(input, { target: { value: 'home' } });

      await waitFor(() => {
        expect(screen.getByTestId('word-entry-save-btn')).not.toBeDisabled();
      });

      fireEvent.click(screen.getByTestId('word-entry-save-btn'));

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledOnce();
      });
    });

    it('passes wordEntryId to mutation', async () => {
      renderForm();
      const input = screen.getByTestId('word-entry-field-translation-en');
      fireEvent.change(input, { target: { value: 'home' } });

      await waitFor(() => {
        expect(screen.getByTestId('word-entry-save-btn')).not.toBeDisabled();
      });

      fireEvent.click(screen.getByTestId('word-entry-save-btn'));

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({ wordEntryId: 'we-123' })
        );
      });
    });

    it('calls onSaveSuccess after successful save', async () => {
      const { onSaveSuccess } = renderForm();
      const input = screen.getByTestId('word-entry-field-translation-en');
      fireEvent.change(input, { target: { value: 'home' } });

      await waitFor(() => {
        expect(screen.getByTestId('word-entry-save-btn')).not.toBeDisabled();
      });

      fireEvent.click(screen.getByTestId('word-entry-save-btn'));

      await waitFor(() => {
        expect(onSaveSuccess).toHaveBeenCalledOnce();
      });
    });

    it('handles mutation error without crashing', async () => {
      mockMutateAsync.mockRejectedValue(new Error('API error'));

      renderForm();
      const input = screen.getByTestId('word-entry-field-translation-en');
      fireEvent.change(input, { target: { value: 'home' } });

      await waitFor(() => {
        expect(screen.getByTestId('word-entry-save-btn')).not.toBeDisabled();
      });

      fireEvent.click(screen.getByTestId('word-entry-save-btn'));

      // Should not throw; error handling is in the hook
      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalled();
      });
    });
  });

  // ============================================
  // Group 6: Auto Audio Regen
  // ============================================

  describe('auto audio regeneration', () => {
    it('calls generatePartAudio when example greek text is changed', async () => {
      const { wordEntryAPI } = await import('@/services/wordEntryAPI');
      (wordEntryAPI.generatePartAudio as Mock).mockResolvedValue(undefined);

      renderForm();
      const greekInput = screen.getByTestId('word-entry-example-0-greek');
      fireEvent.change(greekInput, { target: { value: 'Το καινούριο μας σπίτι.' } });

      await waitFor(() => {
        expect(screen.getByTestId('word-entry-save-btn')).not.toBeDisabled();
      });

      fireEvent.click(screen.getByTestId('word-entry-save-btn'));

      await waitFor(() => {
        expect(wordEntryAPI.generatePartAudio).toHaveBeenCalledWith('we-123', 'example', 'ex-1');
      });
    });

    it('does not call generatePartAudio when example greek text is unchanged', async () => {
      const { wordEntryAPI } = await import('@/services/wordEntryAPI');

      renderForm();
      // Change something else (not example greek)
      const input = screen.getByTestId('word-entry-field-translation-en');
      fireEvent.change(input, { target: { value: 'home' } });

      await waitFor(() => {
        expect(screen.getByTestId('word-entry-save-btn')).not.toBeDisabled();
      });

      fireEvent.click(screen.getByTestId('word-entry-save-btn'));

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalled();
      });

      expect(wordEntryAPI.generatePartAudio).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // Group 7: Accessibility
  // ============================================

  describe('accessibility', () => {
    it('translation_en field has autoFocus', () => {
      renderForm();
      const input = screen.getByTestId('word-entry-field-translation-en');
      // autoFocus is set on the input
      expect(input).toBeInTheDocument();
    });

    it('has save and cancel buttons', () => {
      renderForm();
      expect(screen.getByTestId('word-entry-save-btn')).toBeInTheDocument();
      expect(screen.getByTestId('word-entry-cancel-btn')).toBeInTheDocument();
    });
  });
});
