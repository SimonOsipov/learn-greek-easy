// src/components/admin/decks/__tests__/CultureQuestionDetail.migration.test.tsx
//
// RED tests for ADMIN2-38-05 — culture question editor Card + inline
// read↔edit + single save path + badge tone + header chrome + Form primitive.
//
// These tests define the NEW contract (AC-4 b/c/d/e/f) BEFORE the migration.
// They fail against the current monolithic-form implementation for the right
// reason (assertion-level / element-not-found), not import/collection errors.
//
// Contract defined here (executor must implement to these testids):
//   culture-question-edit-card   — the "Question & Answers" Card wrapper
//   culture-question-edit-btn    — Pencil in Card header (flips to edit mode)
//   culture-question-read-view   — read-mode content inside the card
//   culture-question-edit-form   — Form-based edit form (only while isEditing)
//   culture-question-card-save   — in-Card Save button (single save path)
//   culture-question-card-cancel — in-Card Cancel button
//
// Removed testids (MUST NOT exist after migration):
//   culture-question-detail-footer
//   culture-question-detail-regenerate
//   culture-question-detail-save
//   culture-question-detail-cancel
//
// Badge contract:
//   <Badge tone="green"> → renders .b-green class, NOT bg-green-500/10

import type { ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

import type { AdminCultureQuestion, UnifiedDeckItem } from '@/services/adminAPI';

import { CultureQuestionDetail } from '../CultureQuestionDetail';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/services/adminAPI', () => ({
  adminAPI: {
    listCultureQuestions: vi.fn(),
    updateCultureQuestion: vi.fn(),
  },
}));

// The migration restructures CultureCardForm rendering (it is now wrapped in a
// Card with read↔edit toggle). We mock CultureCardForm at a minimal level here
// so CultureQuestionDetail tests can focus on the wrapper structure.
// The migrated CultureCardForm owns its own in-Card Save / Cancel (testids
// culture-question-card-save / culture-question-card-cancel) inside its <form>;
// the wrapper supplies the Card / read-view / Pencil / edit-form chrome. This
// stub mirrors that real contract so the wrapper's assertions bind to the same
// testid surface the real component exposes.
vi.mock('@/components/admin/CultureCardForm', () => ({
  CultureCardForm: ({
    initialData,
    onSubmit,
    onCancel,
    deckId,
    isSubmitting,
  }: {
    initialData?: AdminCultureQuestion;
    onSubmit: (data: unknown) => Promise<void>;
    onCancel?: () => void;
    deckId?: string;
    isSubmitting?: boolean;
  }) => (
    <div data-testid="culture-card-form">
      <span data-testid="culture-card-form-deck-id">{deckId ?? ''}</span>
      {initialData !== undefined && (
        <span data-testid="culture-card-form-has-initial-data">has-initial-data</span>
      )}
      <span data-testid="culture-card-form-submitting">{String(isSubmitting ?? false)}</span>
      {onCancel && (
        <button data-testid="culture-question-card-cancel" onClick={() => onCancel()}>
          Cancel
        </button>
      )}
      <button
        data-testid="culture-question-card-save"
        onClick={() =>
          onSubmit({
            deck_id: deckId,
            question_text: { en: 'Q', el: 'Q', ru: 'Q' },
            option_a: { en: 'A', el: 'A', ru: 'A' },
            option_b: { en: 'B', el: 'B', ru: 'B' },
            option_c: null,
            option_d: null,
            correct_option: 1,
          })
        }
      >
        Save
      </button>
    </div>
  ),
}));

import { adminAPI } from '@/services/adminAPI';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const DECK_ID = 'deck-culture-1';
const QUESTION_ID = 'q-migration-1';

const makeCultureDeck = (overrides: Partial<UnifiedDeckItem> = {}): UnifiedDeckItem => ({
  id: DECK_ID,
  name: { el: 'Ελληνική κουλτούρα', en: 'Greek Culture', ru: 'Греческая культура' },
  name_en: 'Greek Culture',
  name_ru: 'Греческая культура',
  type: 'culture',
  level: null,
  category: 'culture',
  item_count: 5,
  is_active: true,
  is_premium: false,
  is_system_deck: null,
  created_at: '2026-01-01T00:00:00Z',
  owner_id: null,
  owner_name: null,
  ...overrides,
});

/** A question where only 2 options are filled — "opts" chip stays gray → Draft */
const makeDraftQuestion = (
  overrides: Partial<AdminCultureQuestion> = {}
): AdminCultureQuestion => ({
  id: QUESTION_ID,
  question_text: {
    en: 'What is the national sport of Greece?',
    el: 'Ποιο είναι το εθνικό άθλημα της Ελλάδας;',
    ru: 'Какой национальный спорт Греции?',
  },
  option_a: { en: 'Football', el: 'Ποδόσφαιρο', ru: 'Футбол' },
  option_b: { en: 'Basketball', el: 'Μπάσκετ', ru: 'Баскетбол' },
  option_c: null,
  option_d: null,
  correct_option: 1,
  source_article_url: null,
  is_pending_review: false,
  audio_s3_key: null,
  news_item_id: null,
  original_article_url: null,
  order_index: 1,
  news_item_audio_a2_s3_key: null,
  created_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

/** A question with all 4 options AND all translations → "opts" chip green + isTranslationComplete → Ready */
const makeReadyQuestion = (overrides: Partial<AdminCultureQuestion> = {}): AdminCultureQuestion =>
  makeDraftQuestion({
    option_c: { en: 'Tennis', el: 'Τένις', ru: 'Теннис' },
    option_d: { en: 'Swimming', el: 'Κολύμβηση', ru: 'Плавание' },
    ...overrides,
  });

function makeListResponse(questions: AdminCultureQuestion[]) {
  return {
    questions,
    total: questions.length,
    page: 1,
    page_size: 50,
    deck_id: DECK_ID,
  };
}

// ── Render helpers ────────────────────────────────────────────────────────────

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function renderDetail(
  deck: UnifiedDeckItem = makeCultureDeck(),
  itemId: string = QUESTION_ID,
  initialUrl = `/admin?edit=${DECK_ID}&item=${itemId}`
) {
  const queryClient = makeQueryClient();

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return render(
    <MemoryRouter initialEntries={[initialUrl]}>
      <Routes>
        <Route path="*" element={<CultureQuestionDetail deck={deck} itemId={itemId} />} />
      </Routes>
    </MemoryRouter>,
    { wrapper: Wrapper }
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CultureQuestionDetail — ADMIN2-38-05 migration contract (RED)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── AC-4b: read mode by default (Pencil not yet clicked) ──────────────────

  it('AC-4b: detail view starts in read mode — "Question & Answers" Card with read view present, no edit form', async () => {
    (adminAPI.listCultureQuestions as Mock).mockResolvedValue(
      makeListResponse([makeDraftQuestion()])
    );

    renderDetail();

    // Wait for load to complete (skeleton gone, question rendered)
    await waitFor(() => {
      expect(screen.getByTestId('culture-question-edit-card')).toBeInTheDocument();
    });

    // Read view should be visible in default (non-editing) state
    expect(screen.getByTestId('culture-question-read-view')).toBeInTheDocument();

    // Edit form should NOT be visible until Pencil is clicked
    expect(screen.queryByTestId('culture-question-edit-form')).not.toBeInTheDocument();
  });

  // ── AC-4b: Pencil flip to edit form ───────────────────────────────────────

  it('AC-4b: clicking the Card Pencil reveals the edit form and hides the read view', async () => {
    const user = userEvent.setup();
    (adminAPI.listCultureQuestions as Mock).mockResolvedValue(
      makeListResponse([makeDraftQuestion()])
    );

    renderDetail();

    await waitFor(() => {
      expect(screen.getByTestId('culture-question-edit-btn')).toBeInTheDocument();
    });

    // Before click: read view present, edit form absent
    expect(screen.getByTestId('culture-question-read-view')).toBeInTheDocument();
    expect(screen.queryByTestId('culture-question-edit-form')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('culture-question-edit-btn'));

    // After click: edit form present, read view gone
    await waitFor(() => {
      expect(screen.getByTestId('culture-question-edit-form')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('culture-question-read-view')).not.toBeInTheDocument();
  });

  // ── AC-4c / F4.8: external footer test-ids must NOT exist ─────────────────

  it('AC-4c: external footer test-ids are absent (footer removed, F4.8 double-save resolved)', async () => {
    (adminAPI.listCultureQuestions as Mock).mockResolvedValue(
      makeListResponse([makeDraftQuestion()])
    );

    renderDetail();

    // Wait for the detail to finish loading
    await waitFor(() => {
      expect(screen.getByTestId('culture-question-edit-card')).toBeInTheDocument();
    });

    // None of the old footer testids should exist after migration
    expect(screen.queryByTestId('culture-question-detail-footer')).not.toBeInTheDocument();
    expect(screen.queryByTestId('culture-question-detail-regenerate')).not.toBeInTheDocument();
    expect(screen.queryByTestId('culture-question-detail-save')).not.toBeInTheDocument();
    expect(screen.queryByTestId('culture-question-detail-cancel')).not.toBeInTheDocument();
  });

  // ── AC-4c: single save path — in-Card Save calls updateCultureQuestion ─────

  it('AC-4c: in-Card Save button (single save path) calls adminAPI.updateCultureQuestion once', async () => {
    const user = userEvent.setup();
    (adminAPI.listCultureQuestions as Mock).mockResolvedValue(
      makeListResponse([makeDraftQuestion()])
    );
    (adminAPI.updateCultureQuestion as Mock).mockResolvedValue({});

    renderDetail();

    // Flip to edit mode
    await waitFor(() => {
      expect(screen.getByTestId('culture-question-edit-btn')).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('culture-question-edit-btn'));

    // Edit form appears with its in-Card save button
    await waitFor(() => {
      expect(screen.getByTestId('culture-question-card-save')).toBeInTheDocument();
    });

    // Submit via in-Card save (the CultureCardForm mock exposes submit via culture-card-form-submit,
    // but in the migrated component the in-Card Save button triggers the form submission)
    await user.click(screen.getByTestId('culture-question-card-save'));

    await waitFor(() => {
      expect(adminAPI.updateCultureQuestion).toHaveBeenCalledTimes(1);
      expect(adminAPI.updateCultureQuestion).toHaveBeenCalledWith(
        QUESTION_ID,
        expect.objectContaining({
          question_text: expect.any(Object),
          option_a: expect.any(Object),
          option_b: expect.any(Object),
        })
      );
    });
  });

  // ── AC-4c: in-Card Cancel exits edit mode ─────────────────────────────────

  it('AC-4c: in-Card Cancel button exits edit mode (returns to read view)', async () => {
    const user = userEvent.setup();
    (adminAPI.listCultureQuestions as Mock).mockResolvedValue(
      makeListResponse([makeDraftQuestion()])
    );

    renderDetail();

    // Enter edit mode
    await waitFor(() => {
      expect(screen.getByTestId('culture-question-edit-btn')).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('culture-question-edit-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('culture-question-card-cancel')).toBeInTheDocument();
    });

    // Click Cancel
    await user.click(screen.getByTestId('culture-question-card-cancel'));

    // Read view restored, edit form gone
    await waitFor(() => {
      expect(screen.getByTestId('culture-question-read-view')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('culture-question-edit-form')).not.toBeInTheDocument();
  });

  // ── AC-4d: Badge uses tone token, NOT raw color classes ───────────────────

  it('AC-4d: pending-review status badge uses Badge tone="amber" (renders .b-amber class, no bg-amber-500/10)', async () => {
    // F3 (ADMIN2-39-02): the badge is now driven SOLELY by is_pending_review, not
    // by option/translation completeness. is_pending_review:true → amber "Pending review".
    (adminAPI.listCultureQuestions as Mock).mockResolvedValue(
      makeListResponse([makeDraftQuestion({ is_pending_review: true })])
    );

    renderDetail();

    await waitFor(() => {
      expect(screen.getByTestId('culture-question-detail-status')).toHaveTextContent(
        'Pending review'
      );
    });

    const badge = screen.getByTestId('culture-question-detail-status');

    // Badge tone="amber" renders via badge.tsx:39 → className includes "b-amber"
    expect(badge.classList.contains('b-amber')).toBe(true);

    // Raw tailwind color class that exists in current code MUST be gone
    expect(badge.classList.contains('bg-amber-500/10')).toBe(false);
    // The class string should not contain raw amber color drift
    expect(badge.className).not.toMatch(/bg-amber-500/);
  });

  it('AC-4d: visible status badge uses Badge tone="green" (renders .b-green class, no bg-green-500/10)', async () => {
    // F3 (ADMIN2-39-02): is_pending_review:false → green "Visible to learners".
    (adminAPI.listCultureQuestions as Mock).mockResolvedValue(
      makeListResponse([makeReadyQuestion({ is_pending_review: false })])
    );

    renderDetail();

    await waitFor(() => {
      expect(screen.getByTestId('culture-question-detail-status')).toHaveTextContent(
        'Visible to learners'
      );
    });

    const badge = screen.getByTestId('culture-question-detail-status');

    // Badge tone="green" → .b-green class
    expect(badge.classList.contains('b-green')).toBe(true);

    // Raw tailwind color class that exists in current code MUST be gone
    expect(badge.className).not.toMatch(/bg-green-500/);
  });

  // ── AC-4f: Header uses vocab-scale chrome (text-2xl), NOT text-lg ─────────

  it('AC-4f: header identity heading is text-2xl (not generic text-lg "Edit question")', async () => {
    (adminAPI.listCultureQuestions as Mock).mockResolvedValue(
      makeListResponse([makeDraftQuestion()])
    );

    renderDetail();

    await waitFor(() => {
      // The identity heading testid (following vocab sibling pattern)
      expect(screen.getByTestId('culture-question-detail-title')).toBeInTheDocument();
    });

    const heading = screen.getByTestId('culture-question-detail-title');

    // Must use text-2xl scale (vocab sibling VocabWordDetail.tsx:166)
    expect(heading.classList.contains('text-2xl')).toBe(true);

    // Must NOT use the old text-lg scale
    expect(heading.classList.contains('text-lg')).toBe(false);
  });

  it('AC-4f: header shows the question text (not the generic "Edit question" copy)', async () => {
    (adminAPI.listCultureQuestions as Mock).mockResolvedValue(
      makeListResponse([makeDraftQuestion()])
    );

    renderDetail();

    await waitFor(() => {
      expect(screen.getByTestId('culture-question-detail-title')).toBeInTheDocument();
    });

    const heading = screen.getByTestId('culture-question-detail-title');

    // The question's English text should appear as the identity heading
    // (resolveQuestionText returns the EN text for this question)
    expect(heading).toHaveTextContent('What is the national sport of Greece?');

    // Generic copy must NOT be used as the heading
    expect(heading).not.toHaveTextContent('Edit question');
  });
});
