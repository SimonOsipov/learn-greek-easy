// src/components/admin/vocabulary/grammar-display/__tests__/ExamplesEditSection.test.tsx

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import { ExamplesEditSection } from '../ExamplesEditSection';
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
// Tests
// ============================================

describe('ExamplesEditSection', () => {
  // ============================================
  // Group 1: Read mode
  // ============================================

  describe('read mode', () => {
    it('renders examples-edit-btn when examples exist', () => {
      renderWithI18n(<ExamplesEditSection wordEntry={createMockWordEntry()} />);
      expect(screen.getByTestId('examples-edit-btn')).toBeInTheDocument();
    });

    it('does NOT render examples-edit-btn when no examples', () => {
      renderWithI18n(<ExamplesEditSection wordEntry={createMockWordEntry({ examples: [] })} />);
      expect(screen.queryByTestId('examples-edit-btn')).not.toBeInTheDocument();
    });

    it('shows example read view with correct content', () => {
      renderWithI18n(<ExamplesEditSection wordEntry={createMockWordEntry()} />);
      const example0 = screen.getByTestId('word-entry-content-example-0');
      expect(example0).toBeInTheDocument();
      expect(example0).toHaveTextContent('Το σπίτι είναι μεγάλο.');
      expect(example0).toHaveTextContent('The house is big.');
      expect(example0).toHaveTextContent('Дом большой.');
    });

    it('shows no-examples state when examples is empty', () => {
      renderWithI18n(<ExamplesEditSection wordEntry={createMockWordEntry({ examples: [] })} />);
      expect(screen.getByTestId('word-entry-content-no-examples')).toBeInTheDocument();
    });

    it('shows no-examples state when examples is null', () => {
      renderWithI18n(<ExamplesEditSection wordEntry={createMockWordEntry({ examples: null })} />);
      expect(screen.getByTestId('word-entry-content-no-examples')).toBeInTheDocument();
    });

    it('shows example count pill', () => {
      renderWithI18n(<ExamplesEditSection wordEntry={createMockWordEntry()} />);
      // Count "1" visible in the count pill
      expect(screen.getByText('1')).toBeInTheDocument();
    });
  });

  // ============================================
  // Group 2: Enter edit mode
  // ============================================

  describe('enter edit mode', () => {
    it('clicking pencil shows edit inputs for example', async () => {
      const user = userEvent.setup();
      renderWithI18n(<ExamplesEditSection wordEntry={createMockWordEntry()} />);

      await user.click(screen.getByTestId('examples-edit-btn'));

      expect(screen.getByTestId('word-entry-example-0-greek')).toBeInTheDocument();
      expect(screen.getByTestId('word-entry-example-0-english')).toBeInTheDocument();
      expect(screen.getByTestId('word-entry-example-0-russian')).toBeInTheDocument();
    });

    it('inputs pre-populated with existing example data', async () => {
      const user = userEvent.setup();
      renderWithI18n(<ExamplesEditSection wordEntry={createMockWordEntry()} />);

      await user.click(screen.getByTestId('examples-edit-btn'));

      expect(screen.getByTestId('word-entry-example-0-greek')).toHaveValue(
        'Το σπίτι είναι μεγάλο.'
      );
      expect(screen.getByTestId('word-entry-example-0-english')).toHaveValue('The house is big.');
      expect(screen.getByTestId('word-entry-example-0-russian')).toHaveValue('Дом большой.');
    });

    it('save button disabled when no changes', async () => {
      const user = userEvent.setup();
      renderWithI18n(<ExamplesEditSection wordEntry={createMockWordEntry()} />);

      await user.click(screen.getByTestId('examples-edit-btn'));

      expect(screen.getByTestId('examples-save-btn')).toBeDisabled();
    });
  });

  // ============================================
  // Group 3: Save payload — english-only change, no audio regen
  // ============================================

  describe('save — english/russian only change does NOT trigger audio regen', () => {
    it('sends examples array with updated english and does NOT call onAudioRegenNeeded', async () => {
      const user = userEvent.setup();
      const onAudioRegenNeeded = vi.fn();
      renderWithI18n(
        <ExamplesEditSection
          wordEntry={createMockWordEntry()}
          onAudioRegenNeeded={onAudioRegenNeeded}
        />
      );

      await user.click(screen.getByTestId('examples-edit-btn'));

      const englishInput = screen.getByTestId('word-entry-example-0-english');
      await user.clear(englishInput);
      await user.type(englishInput, 'The home is large.');

      await user.click(screen.getByTestId('examples-save-btn'));

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith({
          wordEntryId: 'we-123',
          payload: expect.objectContaining({
            examples: expect.arrayContaining([
              expect.objectContaining({
                id: 'ex-1',
                greek: 'Το σπίτι είναι μεγάλο.',
                english: 'The home is large.',
              }),
            ]),
          }),
        });
      });

      // Audio regen must NOT fire when only english changed
      expect(onAudioRegenNeeded).not.toHaveBeenCalled();
    });

    it('does NOT call onAudioRegenNeeded when only russian changes', async () => {
      const user = userEvent.setup();
      const onAudioRegenNeeded = vi.fn();
      renderWithI18n(
        <ExamplesEditSection
          wordEntry={createMockWordEntry()}
          onAudioRegenNeeded={onAudioRegenNeeded}
        />
      );

      await user.click(screen.getByTestId('examples-edit-btn'));

      const russianInput = screen.getByTestId('word-entry-example-0-russian');
      await user.clear(russianInput);
      await user.type(russianInput, 'Дом большой (новый).');

      await user.click(screen.getByTestId('examples-save-btn'));

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalled();
      });

      expect(onAudioRegenNeeded).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // Group 4: Save payload — greek change TRIGGERS audio regen
  // ============================================

  describe('save — greek change triggers audio regen', () => {
    it('calls onAudioRegenNeeded once when existing example GREEK changes', async () => {
      const user = userEvent.setup();
      const onAudioRegenNeeded = vi.fn();
      renderWithI18n(
        <ExamplesEditSection
          wordEntry={createMockWordEntry()}
          onAudioRegenNeeded={onAudioRegenNeeded}
        />
      );

      await user.click(screen.getByTestId('examples-edit-btn'));

      const greekInput = screen.getByTestId('word-entry-example-0-greek');
      await user.clear(greekInput);
      await user.type(greekInput, 'Το σπίτι είναι πολύ μεγάλο.');

      await user.click(screen.getByTestId('examples-save-btn'));

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalled();
      });

      expect(onAudioRegenNeeded).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================
  // Group 5: Cancel / Discard flow
  // ============================================

  describe('cancel/discard flow', () => {
    it('cancel exits immediately when no changes', async () => {
      const user = userEvent.setup();
      renderWithI18n(<ExamplesEditSection wordEntry={createMockWordEntry()} />);

      await user.click(screen.getByTestId('examples-edit-btn'));
      await user.click(screen.getByTestId('examples-cancel-btn'));

      expect(screen.getByTestId('examples-edit-btn')).toBeInTheDocument();
    });

    it('cancel shows discard dialog when form is dirty', async () => {
      const user = userEvent.setup();
      renderWithI18n(<ExamplesEditSection wordEntry={createMockWordEntry()} />);

      await user.click(screen.getByTestId('examples-edit-btn'));

      const greekInput = screen.getByTestId('word-entry-example-0-greek');
      await user.clear(greekInput);
      await user.type(greekInput, 'Το σπίτι είναι πολύ μεγάλο.');

      await user.click(screen.getByTestId('examples-cancel-btn'));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /discard/i })).toBeInTheDocument();
      });
    });

    it('stays in edit mode on save error', async () => {
      const user = userEvent.setup();
      mockMutateAsync.mockRejectedValueOnce(new Error('fail'));
      renderWithI18n(<ExamplesEditSection wordEntry={createMockWordEntry()} />);

      await user.click(screen.getByTestId('examples-edit-btn'));

      const greekInput = screen.getByTestId('word-entry-example-0-greek');
      await user.clear(greekInput);
      await user.type(greekInput, 'Νέο κείμενο.');

      await user.click(screen.getByTestId('examples-save-btn'));

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalled();
      });
      expect(screen.getByTestId('examples-save-btn')).toBeInTheDocument();
      expect(screen.getByTestId('examples-cancel-btn')).toBeInTheDocument();
    });
  });
});
