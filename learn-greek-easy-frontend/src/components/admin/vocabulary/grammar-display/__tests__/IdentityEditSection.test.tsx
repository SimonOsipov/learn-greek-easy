// src/components/admin/vocabulary/grammar-display/__tests__/IdentityEditSection.test.tsx

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import { IdentityEditSection } from '../IdentityEditSection';
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

const defaultProps = {
  onGenerateClick: vi.fn(),
  isGenerating: false,
};

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

describe('IdentityEditSection', () => {
  // ============================================
  // Group 1: Read mode
  // ============================================

  describe('read mode', () => {
    it('renders identity-edit-btn pencil in read mode', () => {
      renderWithI18n(<IdentityEditSection wordEntry={createMockWordEntry()} {...defaultProps} />);
      expect(screen.getByTestId('identity-edit-btn')).toBeInTheDocument();
    });

    it('shows POS in read mode', () => {
      renderWithI18n(<IdentityEditSection wordEntry={createMockWordEntry()} {...defaultProps} />);
      expect(screen.getByTestId('word-entry-content-pos')).toHaveTextContent('Noun');
    });

    it('shows pronunciation in read mode', () => {
      renderWithI18n(<IdentityEditSection wordEntry={createMockWordEntry()} {...defaultProps} />);
      expect(screen.getByTestId('word-entry-content-pronunciation')).toHaveTextContent('/spí·ti/');
    });

    it('renders audio-status-badge-lemma in read mode', () => {
      renderWithI18n(<IdentityEditSection wordEntry={createMockWordEntry()} {...defaultProps} />);
      expect(screen.getByTestId('audio-status-badge-lemma')).toBeInTheDocument();
    });

    it('renders audio-generate-btn-lemma in read mode', () => {
      renderWithI18n(<IdentityEditSection wordEntry={createMockWordEntry()} {...defaultProps} />);
      expect(screen.getByTestId('audio-generate-btn-lemma')).toBeInTheDocument();
    });

    it('shows completeness badge 2/2 when pronunciation + audio ready', () => {
      renderWithI18n(<IdentityEditSection wordEntry={createMockWordEntry()} {...defaultProps} />);
      expect(screen.getByText('2/2')).toBeInTheDocument();
    });

    it('does not show save/cancel in read mode', () => {
      renderWithI18n(<IdentityEditSection wordEntry={createMockWordEntry()} {...defaultProps} />);
      expect(screen.queryByTestId('identity-save-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('identity-cancel-btn')).not.toBeInTheDocument();
    });
  });

  // ============================================
  // Group 2: Enter edit mode — only pronunciation editable
  // ============================================

  describe('enter edit mode', () => {
    it('clicking pencil shows pronunciation input', async () => {
      const user = userEvent.setup();
      renderWithI18n(<IdentityEditSection wordEntry={createMockWordEntry()} {...defaultProps} />);

      await user.click(screen.getByTestId('identity-edit-btn'));

      expect(screen.getByTestId('word-entry-field-pronunciation')).toBeInTheDocument();
    });

    it('lemma is displayed read-only in edit mode (not an input)', async () => {
      const user = userEvent.setup();
      renderWithI18n(<IdentityEditSection wordEntry={createMockWordEntry()} {...defaultProps} />);

      await user.click(screen.getByTestId('identity-edit-btn'));

      // Lemma displayed read-only
      const lemmaField = screen.getByTestId('word-entry-field-lemma');
      expect(lemmaField).toBeInTheDocument();
      expect(lemmaField.querySelector('input')).toBeNull();
      expect(lemmaField).toHaveTextContent('σπίτι');
    });

    it('part_of_speech is displayed read-only in edit mode (not an input)', async () => {
      const user = userEvent.setup();
      renderWithI18n(<IdentityEditSection wordEntry={createMockWordEntry()} {...defaultProps} />);

      await user.click(screen.getByTestId('identity-edit-btn'));

      const posField = screen.getByTestId('word-entry-field-part-of-speech');
      expect(posField).toBeInTheDocument();
      expect(posField.querySelector('input')).toBeNull();
      expect(posField).toHaveTextContent('Noun');
    });

    it('pronunciation input pre-populated', async () => {
      const user = userEvent.setup();
      renderWithI18n(<IdentityEditSection wordEntry={createMockWordEntry()} {...defaultProps} />);

      await user.click(screen.getByTestId('identity-edit-btn'));

      expect(screen.getByTestId('word-entry-field-pronunciation')).toHaveValue('/spí·ti/');
    });

    it('pronunciation input is empty string when pronunciation is null', async () => {
      const user = userEvent.setup();
      renderWithI18n(
        <IdentityEditSection
          wordEntry={createMockWordEntry({ pronunciation: null })}
          {...defaultProps}
        />
      );

      await user.click(screen.getByTestId('identity-edit-btn'));

      expect(screen.getByTestId('word-entry-field-pronunciation')).toHaveValue('');
    });

    it('save button is disabled when no changes made', async () => {
      const user = userEvent.setup();
      renderWithI18n(<IdentityEditSection wordEntry={createMockWordEntry()} {...defaultProps} />);

      await user.click(screen.getByTestId('identity-edit-btn'));

      expect(screen.getByTestId('identity-save-btn')).toBeDisabled();
    });
  });

  // ============================================
  // Group 3: Save payload — pronunciation only
  // ============================================

  describe('save flow', () => {
    it('saves pronunciation with correct payload', async () => {
      const user = userEvent.setup();
      renderWithI18n(<IdentityEditSection wordEntry={createMockWordEntry()} {...defaultProps} />);

      await user.click(screen.getByTestId('identity-edit-btn'));

      const input = screen.getByTestId('word-entry-field-pronunciation');
      await user.clear(input);
      await user.type(input, '/spiti/');

      await user.click(screen.getByTestId('identity-save-btn'));

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith({
          wordEntryId: 'we-123',
          payload: expect.objectContaining({
            pronunciation: '/spiti/',
          }),
        });
      });

      // Lemma and POS must NOT be in the payload
      const call = mockMutateAsync.mock.calls[0][0];
      expect(call.payload).not.toHaveProperty('lemma');
      expect(call.payload).not.toHaveProperty('part_of_speech');
    });

    it('sends null when pronunciation is cleared', async () => {
      const user = userEvent.setup();
      renderWithI18n(<IdentityEditSection wordEntry={createMockWordEntry()} {...defaultProps} />);

      await user.click(screen.getByTestId('identity-edit-btn'));

      const input = screen.getByTestId('word-entry-field-pronunciation');
      await user.clear(input);

      await user.click(screen.getByTestId('identity-save-btn'));

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith({
          wordEntryId: 'we-123',
          payload: expect.objectContaining({
            pronunciation: null,
          }),
        });
      });
    });

    it('exits edit mode on successful save', async () => {
      const user = userEvent.setup();
      renderWithI18n(<IdentityEditSection wordEntry={createMockWordEntry()} {...defaultProps} />);

      await user.click(screen.getByTestId('identity-edit-btn'));

      const input = screen.getByTestId('word-entry-field-pronunciation');
      await user.clear(input);
      await user.type(input, '/spiti/');

      await user.click(screen.getByTestId('identity-save-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('identity-edit-btn')).toBeInTheDocument();
      });
    });

    it('stays in edit mode on save error', async () => {
      const user = userEvent.setup();
      mockMutateAsync.mockRejectedValueOnce(new Error('fail'));
      renderWithI18n(<IdentityEditSection wordEntry={createMockWordEntry()} {...defaultProps} />);

      await user.click(screen.getByTestId('identity-edit-btn'));

      const input = screen.getByTestId('word-entry-field-pronunciation');
      await user.clear(input);
      await user.type(input, '/spiti/');

      await user.click(screen.getByTestId('identity-save-btn'));

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalled();
      });
      expect(screen.getByTestId('identity-save-btn')).toBeInTheDocument();
    });
  });

  // ============================================
  // Group 4: Cancel / Discard flow
  // ============================================

  describe('cancel/discard flow', () => {
    it('cancel exits immediately when no changes', async () => {
      const user = userEvent.setup();
      renderWithI18n(<IdentityEditSection wordEntry={createMockWordEntry()} {...defaultProps} />);

      await user.click(screen.getByTestId('identity-edit-btn'));
      await user.click(screen.getByTestId('identity-cancel-btn'));

      expect(screen.getByTestId('identity-edit-btn')).toBeInTheDocument();
    });

    it('cancel shows discard dialog when form is dirty', async () => {
      const user = userEvent.setup();
      renderWithI18n(<IdentityEditSection wordEntry={createMockWordEntry()} {...defaultProps} />);

      await user.click(screen.getByTestId('identity-edit-btn'));

      const input = screen.getByTestId('word-entry-field-pronunciation');
      await user.clear(input);
      await user.type(input, '/spiti/');

      await user.click(screen.getByTestId('identity-cancel-btn'));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /discard/i })).toBeInTheDocument();
      });
    });

    it('calls onEditingChange(false) on clean cancel', async () => {
      const user = userEvent.setup();
      const onEditingChange = vi.fn();
      renderWithI18n(
        <IdentityEditSection
          wordEntry={createMockWordEntry()}
          {...defaultProps}
          onEditingChange={onEditingChange}
        />
      );

      await user.click(screen.getByTestId('identity-edit-btn'));
      onEditingChange.mockClear();
      await user.click(screen.getByTestId('identity-cancel-btn'));

      expect(onEditingChange).toHaveBeenCalledWith(false);
    });
  });

  // ============================================
  // Group 5: Audio generate button
  // ============================================

  describe('audio generate button', () => {
    it('clicking audio-generate-btn-lemma calls onGenerateClick', async () => {
      const user = userEvent.setup();
      const onGenerateClick = vi.fn();
      renderWithI18n(
        <IdentityEditSection
          wordEntry={createMockWordEntry({ audio_status: 'missing' })}
          onGenerateClick={onGenerateClick}
          isGenerating={false}
        />
      );

      await user.click(screen.getByTestId('audio-generate-btn-lemma'));
      expect(onGenerateClick).toHaveBeenCalledOnce();
    });
  });

  // ============================================
  // Group 6: Hover-reveal + chrome-ghost (AC-1, ADMIN2-38-03)
  // ============================================

  describe('hover-reveal and chrome-ghost (AC-1)', () => {
    it('pencil is wrapped in an actions container with opacity-0 at rest', () => {
      renderWithI18n(<IdentityEditSection wordEntry={createMockWordEntry()} {...defaultProps} />);
      // After implementation: the pencil button is wrapped in a div with data-testid="identity-pencil-actions"
      // and classes opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100.
      // Currently: no such wrapper exists — getByTestId throws → RED.
      const container = screen.getByTestId('identity-pencil-actions');
      expect(container.className).toContain('opacity-0');
      expect(container.className).toContain('transition-opacity');
      expect(container.className).toContain('group-hover:opacity-100');
      expect(container.className).toContain('group-focus-within:opacity-100');
    });

    it('header row ancestor carries the group class', () => {
      renderWithI18n(<IdentityEditSection wordEntry={createMockWordEntry()} {...defaultProps} />);
      // After implementation: the flex items-center justify-between row div gets the `group` class.
      // We verify via the actions container's parent.
      const container = screen.getByTestId('identity-pencil-actions');
      const headerRow = container.parentElement;
      expect(headerRow?.className).toContain('group');
    });

    it('pencil Button uses chrome-ghost variant (hover:bg-muted, not hover:bg-accent)', () => {
      renderWithI18n(<IdentityEditSection wordEntry={createMockWordEntry()} {...defaultProps} />);
      // After implementation: the Button has variant="chrome-ghost" which CVA resolves to
      // "text-foreground hover:bg-muted hover:text-foreground" (button.tsx:19).
      // Currently: variant="ghost" gives hover:bg-accent → assertion fails RED.
      const container = screen.getByTestId('identity-pencil-actions');
      const button = container.querySelector('button');
      expect(button?.className).toContain('hover:bg-muted');
      expect(button?.className).not.toContain('hover:bg-accent');
    });

    it('pencil still enters edit mode on click (regression guard)', async () => {
      const user = userEvent.setup();
      renderWithI18n(<IdentityEditSection wordEntry={createMockWordEntry()} {...defaultProps} />);
      // After implementation: clicking the pencil (now inside the actions container) still triggers edit.
      // Test queries via testid of the button itself — robust even after wrapping.
      await user.click(screen.getByTestId('identity-edit-btn'));
      expect(screen.getByTestId('identity-edit-form')).toBeInTheDocument();
    });

    it('pencil-actions wrapper is removed from DOM while isEditing (adversarial: !isEditing guard)', async () => {
      const user = userEvent.setup();
      renderWithI18n(<IdentityEditSection wordEntry={createMockWordEntry()} {...defaultProps} />);
      // In read mode the wrapper is present.
      expect(screen.getByTestId('identity-pencil-actions')).toBeInTheDocument();
      // Enter edit mode.
      await user.click(screen.getByTestId('identity-edit-btn'));
      // The !isEditing guard must remove the entire wrapper from the DOM — not just hide it.
      expect(screen.queryByTestId('identity-pencil-actions')).not.toBeInTheDocument();
    });
  });
});
