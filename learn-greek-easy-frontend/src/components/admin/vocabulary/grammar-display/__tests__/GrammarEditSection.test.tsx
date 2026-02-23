// src/components/admin/vocabulary/grammar-display/__tests__/GrammarEditSection.test.tsx

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import { GrammarEditSection } from '../GrammarEditSection';
import type { WordEntryResponse } from '@/services/wordEntryAPI';

// ============================================
// Mocks
// ============================================

const mockMutateAsync = vi.fn();

vi.mock('@/features/words/hooks/useUpdateWordEntry', () => ({
  useUpdateWordEntry: vi.fn(() => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  })),
}));

// ============================================
// Helpers
// ============================================

function createMockWordEntry(overrides: Partial<WordEntryResponse> = {}): WordEntryResponse {
  return {
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
  };
}

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
}

// ============================================
// Setup
// ============================================

beforeEach(() => {
  vi.clearAllMocks();
  mockMutateAsync.mockResolvedValue({});
});

// ============================================
// Group 1: Rendering (read-only mode)
// ============================================

describe('GrammarEditSection', () => {
  describe('rendering (read-only mode)', () => {
    it('renders pencil edit button', () => {
      renderWithI18n(<GrammarEditSection wordEntry={createMockWordEntry()} />);
      expect(screen.getByTestId('grammar-edit-btn')).toBeInTheDocument();
    });

    it('does not show save/cancel buttons in read mode', () => {
      renderWithI18n(<GrammarEditSection wordEntry={createMockWordEntry()} />);
      expect(screen.queryByTestId('grammar-save-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('grammar-cancel-btn')).not.toBeInTheDocument();
    });

    it('shows completeness badge for noun with partial data', () => {
      const wordEntry = createMockWordEntry({ grammar_data: { gender: 'neuter' } });
      renderWithI18n(<GrammarEditSection wordEntry={wordEntry} />);
      expect(screen.getByText('1/9')).toBeInTheDocument();
    });

    it('shows completeness badge for fully populated noun', () => {
      const wordEntry = createMockWordEntry({
        grammar_data: {
          gender: 'neuter',
          cases: {
            singular: {
              nominative: 'σπίτι',
              genitive: 'σπιτιού',
              accusative: 'σπίτι',
              vocative: 'σπίτι',
            },
            plural: {
              nominative: 'σπίτια',
              genitive: 'σπιτιών',
              accusative: 'σπίτια',
              vocative: 'σπίτια',
            },
          },
        },
      });
      renderWithI18n(<GrammarEditSection wordEntry={wordEntry} />);
      expect(screen.getByText('9/9')).toBeInTheDocument();
    });

    it('returns null for phrase POS', () => {
      const wordEntry = createMockWordEntry({
        part_of_speech: 'phrase' as any,
        grammar_data: null,
      });
      const { container } = renderWithI18n(<GrammarEditSection wordEntry={wordEntry} />);
      expect(container.innerHTML).toBe('');
    });
  });

  // ============================================
  // Group 2: Enter edit mode
  // ============================================

  describe('enter edit mode', () => {
    it('clicking pencil shows edit form with pre-populated values', async () => {
      const user = userEvent.setup();
      const wordEntry = createMockWordEntry({ grammar_data: { gender: 'neuter' } });
      renderWithI18n(<GrammarEditSection wordEntry={wordEntry} />);

      await user.click(screen.getByTestId('grammar-edit-btn'));

      expect(screen.getByTestId('noun-grammar-edit-form')).toBeInTheDocument();
      // Gender select trigger should show "Neuter"
      expect(screen.getByTestId('grammar-field-gender')).toHaveTextContent('Neuter');
    });

    it('calls onEditingChange(true) when entering edit mode', async () => {
      const user = userEvent.setup();
      const onEditingChange = vi.fn();
      renderWithI18n(
        <GrammarEditSection wordEntry={createMockWordEntry()} onEditingChange={onEditingChange} />
      );

      await user.click(screen.getByTestId('grammar-edit-btn'));

      expect(onEditingChange).toHaveBeenCalledWith(true);
    });

    it('hides pencil button while in edit mode', async () => {
      const user = userEvent.setup();
      renderWithI18n(<GrammarEditSection wordEntry={createMockWordEntry()} />);

      await user.click(screen.getByTestId('grammar-edit-btn'));

      expect(screen.queryByTestId('grammar-edit-btn')).not.toBeInTheDocument();
    });
  });

  // ============================================
  // Group 3: Edit mode with null grammar_data
  // ============================================

  describe('edit mode with null grammar_data', () => {
    it('renders empty form when grammar_data is null', async () => {
      const user = userEvent.setup();
      const wordEntry = createMockWordEntry({ grammar_data: null });
      renderWithI18n(<GrammarEditSection wordEntry={wordEntry} />);

      await user.click(screen.getByTestId('grammar-edit-btn'));

      // Text inputs should have empty values
      const nomSgInput = screen.getByTestId(
        'grammar-field-nominative_singular'
      ) as HTMLInputElement;
      expect(nomSgInput.value).toBe('');
    });
  });

  // ============================================
  // Group 4: Save flow
  // ============================================

  describe('save flow', () => {
    it('save button disabled when no changes made', async () => {
      const user = userEvent.setup();
      renderWithI18n(<GrammarEditSection wordEntry={createMockWordEntry()} />);

      await user.click(screen.getByTestId('grammar-edit-btn'));

      expect(screen.getByTestId('grammar-save-btn')).toBeDisabled();
    });

    it('save button enabled after making changes', async () => {
      const user = userEvent.setup();
      renderWithI18n(
        <GrammarEditSection wordEntry={createMockWordEntry({ grammar_data: null })} />
      );

      await user.click(screen.getByTestId('grammar-edit-btn'));

      const input = screen.getByTestId('grammar-field-nominative_singular');
      await user.type(input, 'σπίτι');

      expect(screen.getByTestId('grammar-save-btn')).not.toBeDisabled();
    });

    it('calls mutateAsync with correct payload on save', async () => {
      const user = userEvent.setup();
      const wordEntry = createMockWordEntry({ grammar_data: null });
      renderWithI18n(<GrammarEditSection wordEntry={wordEntry} />);

      await user.click(screen.getByTestId('grammar-edit-btn'));

      const input = screen.getByTestId('grammar-field-nominative_singular');
      await user.type(input, 'σπίτι');
      await user.click(screen.getByTestId('grammar-save-btn'));

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith({
          wordEntryId: 'we-123',
          payload: {
            grammar_data: expect.objectContaining({
              nominative_singular: 'σπίτι',
              // Empty strings become null
              gender: null,
              nominative_plural: null,
            }),
          },
        });
      });
    });

    it('exits edit mode on successful save', async () => {
      const user = userEvent.setup();
      renderWithI18n(
        <GrammarEditSection wordEntry={createMockWordEntry({ grammar_data: null })} />
      );

      await user.click(screen.getByTestId('grammar-edit-btn'));

      const input = screen.getByTestId('grammar-field-nominative_singular');
      await user.type(input, 'σπίτι');
      await user.click(screen.getByTestId('grammar-save-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('grammar-edit-btn')).toBeInTheDocument();
      });
    });

    it('calls onEditingChange(false) on successful save', async () => {
      const user = userEvent.setup();
      const onEditingChange = vi.fn();
      renderWithI18n(
        <GrammarEditSection
          wordEntry={createMockWordEntry({ grammar_data: null })}
          onEditingChange={onEditingChange}
        />
      );

      await user.click(screen.getByTestId('grammar-edit-btn'));

      const input = screen.getByTestId('grammar-field-nominative_singular');
      await user.type(input, 'σπίτι');
      await user.click(screen.getByTestId('grammar-save-btn'));

      await waitFor(() => {
        expect(onEditingChange).toHaveBeenCalledWith(false);
      });
    });
  });

  // ============================================
  // Group 5: Cancel/Discard flow
  // ============================================

  describe('cancel/discard flow', () => {
    it('cancel exits immediately when no changes', async () => {
      const user = userEvent.setup();
      renderWithI18n(<GrammarEditSection wordEntry={createMockWordEntry()} />);

      await user.click(screen.getByTestId('grammar-edit-btn'));
      await user.click(screen.getByTestId('grammar-cancel-btn'));

      // Back in read mode
      expect(screen.getByTestId('grammar-edit-btn')).toBeInTheDocument();
    });

    it('cancel shows discard dialog when form is dirty', async () => {
      const user = userEvent.setup();
      renderWithI18n(
        <GrammarEditSection wordEntry={createMockWordEntry({ grammar_data: null })} />
      );

      await user.click(screen.getByTestId('grammar-edit-btn'));

      const input = screen.getByTestId('grammar-field-nominative_singular');
      await user.type(input, 'σπίτι');
      await user.click(screen.getByTestId('grammar-cancel-btn'));

      // Discard dialog should appear with Discard and Keep Editing buttons
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /discard/i })).toBeInTheDocument();
      });
    });

    it('discard confirm resets and exits edit mode', async () => {
      const user = userEvent.setup();
      renderWithI18n(
        <GrammarEditSection wordEntry={createMockWordEntry({ grammar_data: null })} />
      );

      await user.click(screen.getByTestId('grammar-edit-btn'));

      const input = screen.getByTestId('grammar-field-nominative_singular');
      await user.type(input, 'σπίτι');
      await user.click(screen.getByTestId('grammar-cancel-btn'));

      // Click Discard in the dialog
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /discard/i })).toBeInTheDocument();
      });
      await user.click(screen.getByRole('button', { name: /discard/i }));

      // Back in read mode
      await waitFor(() => {
        expect(screen.getByTestId('grammar-edit-btn')).toBeInTheDocument();
      });
    });

    it('discard cancel stays in edit mode', async () => {
      const user = userEvent.setup();
      renderWithI18n(
        <GrammarEditSection wordEntry={createMockWordEntry({ grammar_data: null })} />
      );

      await user.click(screen.getByTestId('grammar-edit-btn'));

      const input = screen.getByTestId('grammar-field-nominative_singular');
      await user.type(input, 'σπίτι');
      await user.click(screen.getByTestId('grammar-cancel-btn'));

      // Click Keep Editing in the dialog
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /keep editing/i })).toBeInTheDocument();
      });
      await user.click(screen.getByRole('button', { name: /keep editing/i }));

      // Still in edit mode
      expect(screen.getByTestId('grammar-save-btn')).toBeInTheDocument();
      expect(screen.getByTestId('grammar-cancel-btn')).toBeInTheDocument();
    });

    it('calls onEditingChange(false) on clean cancel', async () => {
      const user = userEvent.setup();
      const onEditingChange = vi.fn();
      renderWithI18n(
        <GrammarEditSection wordEntry={createMockWordEntry()} onEditingChange={onEditingChange} />
      );

      await user.click(screen.getByTestId('grammar-edit-btn'));
      onEditingChange.mockClear();
      await user.click(screen.getByTestId('grammar-cancel-btn'));

      expect(onEditingChange).toHaveBeenCalledWith(false);
    });

    it('calls onEditingChange(false) on discard confirm', async () => {
      const user = userEvent.setup();
      const onEditingChange = vi.fn();
      renderWithI18n(
        <GrammarEditSection
          wordEntry={createMockWordEntry({ grammar_data: null })}
          onEditingChange={onEditingChange}
        />
      );

      await user.click(screen.getByTestId('grammar-edit-btn'));
      onEditingChange.mockClear();

      const input = screen.getByTestId('grammar-field-nominative_singular');
      await user.type(input, 'σπίτι');
      await user.click(screen.getByTestId('grammar-cancel-btn'));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /discard/i })).toBeInTheDocument();
      });
      await user.click(screen.getByRole('button', { name: /discard/i }));

      await waitFor(() => {
        expect(onEditingChange).toHaveBeenCalledWith(false);
      });
    });
  });

  // ============================================
  // Group 6: Error handling
  // ============================================

  describe('error handling', () => {
    it('stays in edit mode on save error', async () => {
      const user = userEvent.setup();
      mockMutateAsync.mockRejectedValueOnce(new Error('fail'));

      renderWithI18n(
        <GrammarEditSection wordEntry={createMockWordEntry({ grammar_data: null })} />
      );

      await user.click(screen.getByTestId('grammar-edit-btn'));

      const input = screen.getByTestId('grammar-field-nominative_singular');
      await user.type(input, 'σπίτι');
      await user.click(screen.getByTestId('grammar-save-btn'));

      // Still in edit mode after error
      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalled();
      });
      expect(screen.getByTestId('grammar-save-btn')).toBeInTheDocument();
      expect(screen.getByTestId('grammar-cancel-btn')).toBeInTheDocument();
    });
  });

  // ============================================
  // Group 7: Different POS rendering
  // ============================================

  describe('different POS rendering', () => {
    it('renders verb edit form with tense tabs', async () => {
      const user = userEvent.setup();
      const wordEntry = createMockWordEntry({
        part_of_speech: 'verb',
        grammar_data: { voice: 'active' },
      });
      renderWithI18n(<GrammarEditSection wordEntry={wordEntry} />);

      await user.click(screen.getByTestId('grammar-edit-btn'));

      expect(screen.getByTestId('verb-grammar-edit-form')).toBeInTheDocument();
    });

    it('renders adjective edit form with gender tabs', async () => {
      const user = userEvent.setup();
      const wordEntry = createMockWordEntry({
        part_of_speech: 'adjective',
        grammar_data: {},
      });
      renderWithI18n(<GrammarEditSection wordEntry={wordEntry} />);

      await user.click(screen.getByTestId('grammar-edit-btn'));

      expect(screen.getByTestId('adjective-grammar-edit-form')).toBeInTheDocument();
    });

    it('renders adverb edit form with 2 fields', async () => {
      const user = userEvent.setup();
      const wordEntry = createMockWordEntry({
        part_of_speech: 'adverb',
        grammar_data: { comparative: null, superlative: null },
      });
      renderWithI18n(<GrammarEditSection wordEntry={wordEntry} />);

      await user.click(screen.getByTestId('grammar-edit-btn'));

      expect(screen.getByTestId('adverb-grammar-edit-form')).toBeInTheDocument();
      expect(screen.getByTestId('grammar-field-comparative')).toBeInTheDocument();
      expect(screen.getByTestId('grammar-field-superlative')).toBeInTheDocument();
    });
  });
});
