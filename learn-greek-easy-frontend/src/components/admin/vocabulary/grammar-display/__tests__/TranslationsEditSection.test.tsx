// src/components/admin/vocabulary/grammar-display/__tests__/TranslationsEditSection.test.tsx

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import { TranslationsEditSection } from '../TranslationsEditSection';
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
    examples: [],
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
// Tests
// ============================================

describe('TranslationsEditSection', () => {
  // ============================================
  // Group 1: Read mode
  // ============================================

  describe('read mode', () => {
    it('renders translations-edit-btn pencil in read mode', () => {
      renderWithI18n(<TranslationsEditSection wordEntry={createMockWordEntry()} />);
      expect(screen.getByTestId('translations-edit-btn')).toBeInTheDocument();
    });

    it('shows all 4 translation fields in read mode', () => {
      renderWithI18n(<TranslationsEditSection wordEntry={createMockWordEntry()} />);
      expect(screen.getByTestId('word-entry-content-translation-en')).toHaveTextContent('house');
      expect(screen.getByTestId('word-entry-content-translation-en-plural')).toHaveTextContent(
        'houses'
      );
      expect(screen.getByTestId('word-entry-content-translation-ru')).toHaveTextContent('дом');
      expect(screen.getByTestId('word-entry-content-translation-ru-plural')).toHaveTextContent(
        'Not set'
      );
    });

    it('shows completeness badge', () => {
      // 3 of 4 fields filled (translation_ru_plural is null)
      renderWithI18n(<TranslationsEditSection wordEntry={createMockWordEntry()} />);
      expect(screen.getByText('3/4')).toBeInTheDocument();
    });

    it('does not show save/cancel in read mode', () => {
      renderWithI18n(<TranslationsEditSection wordEntry={createMockWordEntry()} />);
      expect(screen.queryByTestId('translations-save-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('translations-cancel-btn')).not.toBeInTheDocument();
    });
  });

  // ============================================
  // Group 2: Enter edit mode
  // ============================================

  describe('enter edit mode', () => {
    it('clicking pencil shows edit form with 4 inputs', async () => {
      const user = userEvent.setup();
      renderWithI18n(<TranslationsEditSection wordEntry={createMockWordEntry()} />);

      await user.click(screen.getByTestId('translations-edit-btn'));

      expect(screen.getByTestId('word-entry-field-translation-en')).toBeInTheDocument();
      expect(screen.getByTestId('word-entry-field-translation-en-plural')).toBeInTheDocument();
      expect(screen.getByTestId('word-entry-field-translation-ru')).toBeInTheDocument();
      expect(screen.getByTestId('word-entry-field-translation-ru-plural')).toBeInTheDocument();
    });

    it('inputs are pre-populated with current values', async () => {
      const user = userEvent.setup();
      renderWithI18n(<TranslationsEditSection wordEntry={createMockWordEntry()} />);

      await user.click(screen.getByTestId('translations-edit-btn'));

      expect(screen.getByTestId('word-entry-field-translation-en')).toHaveValue('house');
      expect(screen.getByTestId('word-entry-field-translation-en-plural')).toHaveValue('houses');
      expect(screen.getByTestId('word-entry-field-translation-ru')).toHaveValue('дом');
      expect(screen.getByTestId('word-entry-field-translation-ru-plural')).toHaveValue('');
    });

    it('save button is disabled when no changes made', async () => {
      const user = userEvent.setup();
      renderWithI18n(<TranslationsEditSection wordEntry={createMockWordEntry()} />);

      await user.click(screen.getByTestId('translations-edit-btn'));

      expect(screen.getByTestId('translations-save-btn')).toBeDisabled();
    });

    it('hides pencil button while in edit mode', async () => {
      const user = userEvent.setup();
      renderWithI18n(<TranslationsEditSection wordEntry={createMockWordEntry()} />);

      await user.click(screen.getByTestId('translations-edit-btn'));

      expect(screen.queryByTestId('translations-edit-btn')).not.toBeInTheDocument();
    });

    it('calls onEditingChange(true) on enter', async () => {
      const user = userEvent.setup();
      const onEditingChange = vi.fn();
      renderWithI18n(
        <TranslationsEditSection
          wordEntry={createMockWordEntry()}
          onEditingChange={onEditingChange}
        />
      );

      await user.click(screen.getByTestId('translations-edit-btn'));

      expect(onEditingChange).toHaveBeenCalledWith(true);
    });
  });

  // ============================================
  // Group 3: Save flow — dirty-only payload
  // ============================================

  describe('save flow', () => {
    it('sends only dirty fields (translation_en + translation_ru changed)', async () => {
      const user = userEvent.setup();
      renderWithI18n(<TranslationsEditSection wordEntry={createMockWordEntry()} />);

      await user.click(screen.getByTestId('translations-edit-btn'));

      const enInput = screen.getByTestId('word-entry-field-translation-en');
      await user.clear(enInput);
      await user.type(enInput, 'home');

      const ruInput = screen.getByTestId('word-entry-field-translation-ru');
      await user.clear(ruInput);
      await user.type(ruInput, 'дом (новый)');

      await user.click(screen.getByTestId('translations-save-btn'));

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith({
          wordEntryId: 'we-123',
          payload: expect.objectContaining({
            translation_en: 'home',
            translation_ru: 'дом (новый)',
          }),
        });
      });

      // translation_en_plural and _ru_plural were NOT changed, should not appear
      const call = mockMutateAsync.mock.calls[0][0];
      expect(call.payload).not.toHaveProperty('translation_en_plural');
      expect(call.payload).not.toHaveProperty('translation_ru_plural');
    });

    it('sends null for cleared optional field', async () => {
      const user = userEvent.setup();
      renderWithI18n(
        <TranslationsEditSection wordEntry={createMockWordEntry({ translation_ru: 'дом' })} />
      );

      await user.click(screen.getByTestId('translations-edit-btn'));

      const ruInput = screen.getByTestId('word-entry-field-translation-ru');
      await user.clear(ruInput);

      await user.click(screen.getByTestId('translations-save-btn'));

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith({
          wordEntryId: 'we-123',
          payload: expect.objectContaining({
            translation_ru: null,
          }),
        });
      });
    });

    it('exits edit mode on successful save', async () => {
      const user = userEvent.setup();
      renderWithI18n(<TranslationsEditSection wordEntry={createMockWordEntry()} />);

      await user.click(screen.getByTestId('translations-edit-btn'));

      const enInput = screen.getByTestId('word-entry-field-translation-en');
      await user.clear(enInput);
      await user.type(enInput, 'home');

      await user.click(screen.getByTestId('translations-save-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('translations-edit-btn')).toBeInTheDocument();
      });
    });

    it('stays in edit mode on save error', async () => {
      const user = userEvent.setup();
      mockMutateAsync.mockRejectedValueOnce(new Error('fail'));
      renderWithI18n(<TranslationsEditSection wordEntry={createMockWordEntry()} />);

      await user.click(screen.getByTestId('translations-edit-btn'));

      const enInput = screen.getByTestId('word-entry-field-translation-en');
      await user.clear(enInput);
      await user.type(enInput, 'home');

      await user.click(screen.getByTestId('translations-save-btn'));

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalled();
      });
      expect(screen.getByTestId('translations-save-btn')).toBeInTheDocument();
      expect(screen.getByTestId('translations-cancel-btn')).toBeInTheDocument();
    });
  });

  // ============================================
  // Group 4: Cancel / Discard flow
  // ============================================

  describe('cancel/discard flow', () => {
    it('cancel exits immediately when no changes', async () => {
      const user = userEvent.setup();
      renderWithI18n(<TranslationsEditSection wordEntry={createMockWordEntry()} />);

      await user.click(screen.getByTestId('translations-edit-btn'));
      await user.click(screen.getByTestId('translations-cancel-btn'));

      expect(screen.getByTestId('translations-edit-btn')).toBeInTheDocument();
    });

    it('cancel shows discard dialog when form is dirty', async () => {
      const user = userEvent.setup();
      renderWithI18n(<TranslationsEditSection wordEntry={createMockWordEntry()} />);

      await user.click(screen.getByTestId('translations-edit-btn'));

      const enInput = screen.getByTestId('word-entry-field-translation-en');
      await user.clear(enInput);
      await user.type(enInput, 'home');

      await user.click(screen.getByTestId('translations-cancel-btn'));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /discard/i })).toBeInTheDocument();
      });
    });

    it('discard confirm exits edit mode', async () => {
      const user = userEvent.setup();
      renderWithI18n(<TranslationsEditSection wordEntry={createMockWordEntry()} />);

      await user.click(screen.getByTestId('translations-edit-btn'));

      const enInput = screen.getByTestId('word-entry-field-translation-en');
      await user.clear(enInput);
      await user.type(enInput, 'home');

      await user.click(screen.getByTestId('translations-cancel-btn'));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /discard/i })).toBeInTheDocument();
      });
      await user.click(screen.getByRole('button', { name: /discard/i }));

      await waitFor(() => {
        expect(screen.getByTestId('translations-edit-btn')).toBeInTheDocument();
      });
    });

    it('calls onEditingChange(false) on clean cancel', async () => {
      const user = userEvent.setup();
      const onEditingChange = vi.fn();
      renderWithI18n(
        <TranslationsEditSection
          wordEntry={createMockWordEntry()}
          onEditingChange={onEditingChange}
        />
      );

      await user.click(screen.getByTestId('translations-edit-btn'));
      onEditingChange.mockClear();
      await user.click(screen.getByTestId('translations-cancel-btn'));

      expect(onEditingChange).toHaveBeenCalledWith(false);
    });
  });

  // ============================================
  // Group 5: Hover-reveal + chrome-ghost (AC-1, ADMIN2-38-03)
  // ============================================

  describe('hover-reveal and chrome-ghost (AC-1)', () => {
    it('pencil is wrapped in an actions container with opacity-0 at rest', () => {
      renderWithI18n(<TranslationsEditSection wordEntry={createMockWordEntry()} />);
      // After implementation: the pencil button is wrapped in a div with data-testid="translations-pencil-actions"
      // and classes opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100.
      // Currently: no such wrapper exists — getByTestId throws → RED.
      const container = screen.getByTestId('translations-pencil-actions');
      expect(container.className).toContain('opacity-0');
      expect(container.className).toContain('transition-opacity');
      expect(container.className).toContain('group-hover:opacity-100');
      expect(container.className).toContain('group-focus-within:opacity-100');
    });

    it('header row ancestor carries the group class', () => {
      renderWithI18n(<TranslationsEditSection wordEntry={createMockWordEntry()} />);
      const container = screen.getByTestId('translations-pencil-actions');
      const headerRow = container.parentElement;
      expect(headerRow?.className).toContain('group');
    });

    it('pencil Button uses chrome-ghost variant (hover:bg-muted, not hover:bg-accent)', () => {
      renderWithI18n(<TranslationsEditSection wordEntry={createMockWordEntry()} />);
      // After implementation: variant="chrome-ghost" → hover:bg-muted (not hover:bg-accent).
      // Currently: variant="ghost" → assertion fails RED.
      const container = screen.getByTestId('translations-pencil-actions');
      const button = container.querySelector('button');
      expect(button?.className).toContain('hover:bg-muted');
      expect(button?.className).not.toContain('hover:bg-accent');
    });

    it('pencil still enters edit mode on click (regression guard)', async () => {
      const user = userEvent.setup();
      renderWithI18n(<TranslationsEditSection wordEntry={createMockWordEntry()} />);
      await user.click(screen.getByTestId('translations-edit-btn'));
      expect(screen.getByTestId('translations-edit-form')).toBeInTheDocument();
    });
  });
});
