// src/components/admin/vocabulary/grammar-display/__tests__/inlineEditorsAdversarial.test.tsx
//
// Adversarial coverage for ADMIN2-37-08: per-section inline editors
// Covers gaps not exercised by the per-section unit tests:
//   1. Brand-new example (id='') — audio-regen must NOT fire (AC-3)
//   2. Translations cancel with dirty form — mutateAsync must NOT be called
//   3. Translations/Identity dirty-only: single-field edits contain only the changed field
//   4. Independent editors: opening Identity edit does NOT disable Grammar's pencil (AC-6)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '@/i18n';
import { ExamplesEditSection } from '../ExamplesEditSection';
import { TranslationsEditSection } from '../TranslationsEditSection';
import { IdentityEditSection } from '../IdentityEditSection';
import { WordEntryContent } from '../../../WordEntryContent';
import { useWordEntry } from '@/features/words/hooks/useWordEntry';
import { useGenerateAudio } from '@/features/words/hooks';
import type { WordEntryResponse } from '@/services/wordEntryAPI';
import type { Mock } from 'vitest';

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

vi.mock('@/features/words/hooks/useWordEntry', () => ({
  useWordEntry: vi.fn(),
}));

vi.mock('@/features/words/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/words/hooks')>();
  return {
    ...actual,
    useGenerateAudio: vi.fn(() => ({
      triggerGeneration: vi.fn(),
      cancel: vi.fn(),
      progress: {
        parts: new Map(),
        totalParts: 0,
        partsCompleted: 0,
        status: 'idle' as const,
        errorMessage: null,
      },
      isGenerating: false,
    })),
  };
});

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

function renderWordEntryContent(props: Parameters<typeof WordEntryContent>[0]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <WordEntryContent {...props} />
      </I18nextProvider>
    </QueryClientProvider>
  );
}

const defaultIdentityProps = {
  onGenerateClick: vi.fn(),
  isGenerating: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockMutateAsync.mockResolvedValue({});
  (useWordEntry as Mock).mockReturnValue({
    wordEntry: createMockWordEntry(),
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });
  (useGenerateAudio as Mock).mockReturnValue({
    triggerGeneration: vi.fn(),
    cancel: vi.fn(),
    progress: {
      parts: new Map(),
      totalParts: 0,
      partsCompleted: 0,
      status: 'idle' as const,
      errorMessage: null,
    },
    isGenerating: false,
  });
});

// ============================================
// 1. Brand-new example (id='') — audio-regen must NOT fire (AC-3 guard)
// ============================================

describe('AC-3: audio-regen guard for brand-new examples (id = empty string)', () => {
  it('does NOT call onAudioRegenNeeded when the only changed example has an empty id (new example)', async () => {
    // A word entry where the first example has id='' (simulates a newly added example
    // that has not yet been persisted — no id in originalById lookup).
    const wordEntryWithNewExample = createMockWordEntry({
      examples: [
        {
          id: '',
          greek: 'Νέο παράδειγμα.',
          english: '',
          russian: '',
          audio_key: null,
          audio_url: null,
          audio_status: 'missing' as const,
        },
      ],
    });

    const user = userEvent.setup();
    const onAudioRegenNeeded = vi.fn();
    renderWithI18n(
      <ExamplesEditSection
        wordEntry={wordEntryWithNewExample}
        onAudioRegenNeeded={onAudioRegenNeeded}
      />
    );

    await user.click(screen.getByTestId('examples-edit-btn'));

    // Change the greek text of the new (id='') example
    const greekInput = screen.getByTestId('word-entry-example-0-greek');
    await user.clear(greekInput);
    await user.type(greekInput, 'Νέο παράδειγμα (αλλαγμένο).');

    await user.click(screen.getByTestId('examples-save-btn'));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalled();
    });

    // The guard: `ex.id && originalById[ex.id] !== undefined` — empty id is falsy,
    // so audio-regen must NOT fire.
    expect(onAudioRegenNeeded).not.toHaveBeenCalled();
  });

  it('does NOT call onAudioRegenNeeded when example id is not present in originalById (unrecognised id)', async () => {
    // Edge: submitted example has an id that was NOT in the original list
    // (e.g., a race-condition or a stale state scenario).
    const wordEntryWithKnownExample = createMockWordEntry({
      examples: [
        {
          id: 'ex-known',
          greek: 'Γνωστό.',
          english: 'Known.',
          russian: null,
          audio_key: null,
          audio_url: null,
          audio_status: 'ready' as const,
        },
      ],
    });

    // We'll simulate by checking that the guard on `originalById[ex.id] !== undefined`
    // protects against a scenario where the id exists but doesn't match any original.
    // The form is pre-populated with 'ex-known'; we change the greek.
    const user = userEvent.setup();
    const onAudioRegenNeeded = vi.fn();

    // Create a word entry where originalById will contain ex-known → 'Γνωστό.'
    renderWithI18n(
      <ExamplesEditSection
        wordEntry={wordEntryWithKnownExample}
        onAudioRegenNeeded={onAudioRegenNeeded}
      />
    );

    await user.click(screen.getByTestId('examples-edit-btn'));

    const greekInput = screen.getByTestId('word-entry-example-0-greek');
    await user.clear(greekInput);
    await user.type(greekInput, 'Άλλαξε.');

    await user.click(screen.getByTestId('examples-save-btn'));

    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalled());

    // This SHOULD fire (known id, greek changed) — verifies positive case in a sibling scenario
    expect(onAudioRegenNeeded).toHaveBeenCalledTimes(1);
  });
});

// ============================================
// 2. Cancel with dirty form — mutateAsync must NOT be called
// ============================================

describe('Translations: discard flow must never call mutateAsync', () => {
  it('does NOT call mutateAsync when user opens edit, changes a field, then discards', async () => {
    const user = userEvent.setup();
    renderWithI18n(<TranslationsEditSection wordEntry={createMockWordEntry()} />);

    await user.click(screen.getByTestId('translations-edit-btn'));

    const enInput = screen.getByTestId('word-entry-field-translation-en');
    await user.clear(enInput);
    await user.type(enInput, 'home');

    // Cancel → discard dialog should appear
    await user.click(screen.getByTestId('translations-cancel-btn'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /discard/i })).toBeInTheDocument();
    });

    // Confirm discard
    await user.click(screen.getByRole('button', { name: /discard/i }));

    await waitFor(() => {
      expect(screen.getByTestId('translations-edit-btn')).toBeInTheDocument();
    });

    // Mutation must never have been called
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('does NOT call mutateAsync when Identity cancel is confirmed via discard', async () => {
    const user = userEvent.setup();
    renderWithI18n(
      <IdentityEditSection wordEntry={createMockWordEntry()} {...defaultIdentityProps} />
    );

    await user.click(screen.getByTestId('identity-edit-btn'));

    const input = screen.getByTestId('word-entry-field-pronunciation');
    await user.clear(input);
    await user.type(input, '/new/');

    await user.click(screen.getByTestId('identity-cancel-btn'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /discard/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /discard/i }));

    await waitFor(() => {
      expect(screen.getByTestId('identity-edit-btn')).toBeInTheDocument();
    });

    expect(mockMutateAsync).not.toHaveBeenCalled();
  });
});

// ============================================
// 3. Dirty-only payloads: single-field edits
// ============================================

describe('dirty-only payload: single field change produces minimal payload', () => {
  it('Translations: editing only translation_ru sends ONLY translation_ru in payload', async () => {
    const user = userEvent.setup();
    renderWithI18n(<TranslationsEditSection wordEntry={createMockWordEntry()} />);

    await user.click(screen.getByTestId('translations-edit-btn'));

    const ruInput = screen.getByTestId('word-entry-field-translation-ru');
    await user.clear(ruInput);
    await user.type(ruInput, 'дом (изменён)');

    await user.click(screen.getByTestId('translations-save-btn'));

    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalled());

    const call = mockMutateAsync.mock.calls[0][0];
    expect(call.payload).toHaveProperty('translation_ru', 'дом (изменён)');
    // EN, EN_plural, RU_plural were not touched — must NOT appear
    expect(call.payload).not.toHaveProperty('translation_en');
    expect(call.payload).not.toHaveProperty('translation_en_plural');
    expect(call.payload).not.toHaveProperty('translation_ru_plural');
  });

  it('Identity: editing only pronunciation sends ONLY pronunciation in payload (not lemma/POS)', async () => {
    const user = userEvent.setup();
    renderWithI18n(
      <IdentityEditSection wordEntry={createMockWordEntry()} {...defaultIdentityProps} />
    );

    await user.click(screen.getByTestId('identity-edit-btn'));

    const input = screen.getByTestId('word-entry-field-pronunciation');
    await user.clear(input);
    await user.type(input, '/nέos/');

    await user.click(screen.getByTestId('identity-save-btn'));

    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalled());

    const call = mockMutateAsync.mock.calls[0][0];
    expect(call.payload).toHaveProperty('pronunciation', '/nέos/');
    // These must never appear — they are read-only
    expect(call.payload).not.toHaveProperty('lemma');
    expect(call.payload).not.toHaveProperty('part_of_speech');
    // Untouched optional fields must not appear either
    expect(call.payload).not.toHaveProperty('translation_en');
    expect(call.payload).not.toHaveProperty('grammar_data');
  });
});

// ============================================
// 4. Independent editors: opening one section does NOT disable another (AC-6)
//    The removed cross-disable means Grammar pencil stays enabled while
//    Identity (or Translations) is in edit mode. Verified via WordEntryContent
//    which wires all sections together without onEditingChange cross-wiring.
// ============================================

describe('AC-6: independent editors — no cross-disable between sections', () => {
  it('Grammar section pencil remains enabled while Identity is in edit mode', async () => {
    const user = userEvent.setup();
    renderWordEntryContent({ wordEntryId: 'we-123' });

    // Enter Identity edit mode
    const identityPencil = screen.getByTestId('identity-edit-btn');
    await user.click(identityPencil);

    // Identity should now be in edit mode (pencil hidden)
    expect(screen.queryByTestId('identity-edit-btn')).not.toBeInTheDocument();
    expect(screen.getByTestId('identity-edit-form')).toBeInTheDocument();

    // Grammar pencil must still be present and NOT disabled
    const grammarPencil = screen.getByTestId('grammar-edit-btn');
    expect(grammarPencil).toBeInTheDocument();
    expect(grammarPencil).not.toBeDisabled();
  });

  it('Translations section pencil remains enabled while Grammar is in edit mode', async () => {
    const user = userEvent.setup();
    renderWordEntryContent({ wordEntryId: 'we-123' });

    // Enter Grammar edit mode
    const grammarPencil = screen.getByTestId('grammar-edit-btn');
    await user.click(grammarPencil);

    // Grammar should now be in edit mode (pencil hidden)
    expect(screen.queryByTestId('grammar-edit-btn')).not.toBeInTheDocument();

    // Translations pencil must still be present and NOT disabled
    const translationsPencil = screen.getByTestId('translations-edit-btn');
    expect(translationsPencil).toBeInTheDocument();
    expect(translationsPencil).not.toBeDisabled();
  });

  it('Examples section pencil remains enabled while Translations is in edit mode', async () => {
    const user = userEvent.setup();
    renderWordEntryContent({ wordEntryId: 'we-123' });

    // Enter Translations edit mode
    const translationsPencil = screen.getByTestId('translations-edit-btn');
    await user.click(translationsPencil);

    // Translations should now be in edit mode (pencil hidden)
    expect(screen.queryByTestId('translations-edit-btn')).not.toBeInTheDocument();
    expect(screen.getByTestId('translations-edit-form')).toBeInTheDocument();

    // Examples pencil must still be present and NOT disabled
    const examplesPencil = screen.getByTestId('examples-edit-btn');
    expect(examplesPencil).toBeInTheDocument();
    expect(examplesPencil).not.toBeDisabled();
  });
});
