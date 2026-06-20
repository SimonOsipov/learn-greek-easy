// src/components/admin/decks/__tests__/CultureQuestionDetail.adversarial.test.tsx
//
// Adversarial coverage for ADMIN2-38-05 — the CORE culture-question-editor
// migration (AC-4 b–f). The migration RED tests (CultureQuestionDetail.migration
// .test.tsx) lock the structural contract (read↔edit, single save, badge, header).
// This file adds the behavioural edges those tests do not exercise:
//
//   1. Optimistic update CORRECTNESS — after an in-Card Save the read view must
//      reflect the NEW values the executor wrote via setQuestion (regression guard
//      for a stale/incorrect render after the optimistic merge).
//   2. Save-FAILURE path — when adminAPI.updateCultureQuestion rejects, the
//      component must stay in edit mode and must NOT optimistically commit the
//      edit to the read view.
//   3. Read view with a MISSING optional language — must render the '—' fallback
//      and not crash (the optimistic merge can produce blank language slots).
//
// These bind to the same testid surface as the migration tests, with the same
// minimal CultureCardForm stub (the stub's Save emits a fixed new-values payload).

import type { ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
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

// Minimal CultureCardForm stub — its Save emits a FIXED new-values payload so we
// can assert the optimistic read-view reflects exactly those values. Distinct
// from the seeded question's values ("…national sport…" / Football / Basketball)
// so a stale render is unambiguously detectable.
vi.mock('@/components/admin/CultureCardForm', () => ({
  CultureCardForm: ({
    onSubmit,
    onCancel,
  }: {
    onSubmit: (data: unknown) => Promise<void>;
    onCancel?: () => void;
  }) => (
    <div data-testid="culture-card-form">
      {onCancel && (
        <button data-testid="culture-question-card-cancel" onClick={() => onCancel()}>
          Cancel
        </button>
      )}
      <button
        data-testid="culture-question-card-save"
        onClick={() =>
          // Mirror the real CultureCardForm: react-hook-form's handleSubmit awaits
          // onSubmit and absorbs a rejection (so a failed save does not surface as
          // an unhandled rejection — the component owns the in-edit recovery state).
          void onSubmit({
            deck_id: 'deck-culture-1',
            question_text: { en: 'EDITED-Q', el: 'EDITED-Q-EL', ru: 'EDITED-Q-RU' },
            option_a: { en: 'EDITED-A', el: 'EDITED-A-EL', ru: 'EDITED-A-RU' },
            option_b: { en: 'EDITED-B', el: 'EDITED-B-EL', ru: 'EDITED-B-RU' },
            option_c: null,
            option_d: null,
            correct_option: 2,
          }).catch(() => {})
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
const QUESTION_ID = 'q-adv-1';

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

const makeQuestion = (overrides: Partial<AdminCultureQuestion> = {}): AdminCultureQuestion => ({
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

function makeListResponse(questions: AdminCultureQuestion[]) {
  return { questions, total: questions.length, page: 1, page_size: 50, deck_id: DECK_ID };
}

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderDetail(deck: UnifiedDeckItem = makeCultureDeck(), itemId: string = QUESTION_ID) {
  const queryClient = makeQueryClient();
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(
    <MemoryRouter initialEntries={[`/admin?edit=${DECK_ID}&item=${itemId}`]}>
      <Routes>
        <Route path="*" element={<CultureQuestionDetail deck={deck} itemId={itemId} />} />
      </Routes>
    </MemoryRouter>,
    { wrapper: Wrapper }
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CultureQuestionDetail — ADMIN2-38-05 adversarial', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 1. Optimistic update correctness ──────────────────────────────────────

  it('after a successful in-Card Save, the read view reflects the NEW values (optimistic merge wiring)', async () => {
    const user = userEvent.setup();
    (adminAPI.listCultureQuestions as Mock).mockResolvedValue(makeListResponse([makeQuestion()]));
    (adminAPI.updateCultureQuestion as Mock).mockResolvedValue({});

    renderDetail();

    // Enter edit mode and save (stub emits the EDITED-* payload, correct_option=2).
    await waitFor(() =>
      expect(screen.getByTestId('culture-question-edit-btn')).toBeInTheDocument()
    );
    await user.click(screen.getByTestId('culture-question-edit-btn'));
    await user.click(screen.getByTestId('culture-question-card-save'));

    // Back in read view with the edited values reflected (no stale render).
    await waitFor(() =>
      expect(screen.getByTestId('culture-question-read-view')).toBeInTheDocument()
    );
    const readView = screen.getByTestId('culture-question-read-view');

    // New question text (EN, identity heading + read row) — old text gone.
    expect(readView).toHaveTextContent('EDITED-Q');
    expect(readView).not.toHaveTextContent('national sport');

    // New answers shown.
    expect(within(readView).getByTestId('culture-question-read-answer-A')).toHaveTextContent(
      'EDITED-A'
    );
    expect(within(readView).getByTestId('culture-question-read-answer-B')).toHaveTextContent(
      'EDITED-B'
    );

    // correct_option moved 1 → 2: the correct marker is now on answer B, not A.
    const answerB = within(readView).getByTestId('culture-question-read-answer-B');
    expect(within(answerB).getByTestId('culture-question-read-correct')).toBeInTheDocument();
    const answerA = within(readView).getByTestId('culture-question-read-answer-A');
    expect(within(answerA).queryByTestId('culture-question-read-correct')).not.toBeInTheDocument();

    // The optimistic merge must NOT trigger a refetch render of stale list data:
    // updateCultureQuestion called exactly once.
    expect(adminAPI.updateCultureQuestion).toHaveBeenCalledTimes(1);
  });

  // ── 2. Save-failure path ──────────────────────────────────────────────────

  it('when updateCultureQuestion rejects, stays in edit mode and does NOT optimistically commit', async () => {
    const user = userEvent.setup();
    (adminAPI.listCultureQuestions as Mock).mockResolvedValue(makeListResponse([makeQuestion()]));
    (adminAPI.updateCultureQuestion as Mock).mockRejectedValue(new Error('boom'));

    renderDetail();

    await waitFor(() =>
      expect(screen.getByTestId('culture-question-edit-btn')).toBeInTheDocument()
    );
    await user.click(screen.getByTestId('culture-question-edit-btn'));

    await waitFor(() =>
      expect(screen.getByTestId('culture-question-edit-form')).toBeInTheDocument()
    );
    await user.click(screen.getByTestId('culture-question-card-save'));

    // The save was attempted…
    await waitFor(() => expect(adminAPI.updateCultureQuestion).toHaveBeenCalledTimes(1));

    // …and on rejection the component remains in edit mode (form still shown,
    // read view not restored) — the optimistic setQuestion + exitEditMode run
    // only AFTER a resolved await, so a rejection commits nothing.
    expect(screen.getByTestId('culture-question-edit-form')).toBeInTheDocument();
    expect(screen.queryByTestId('culture-question-read-view')).not.toBeInTheDocument();
  });

  // ── 3. Read view with a missing optional language ─────────────────────────

  it('read view renders the "—" fallback for a blank language slot without crashing', async () => {
    (adminAPI.listCultureQuestions as Mock).mockResolvedValue(
      makeListResponse([
        makeQuestion({
          // EL question text blank → read view EL row must show the em-dash fallback.
          question_text: {
            en: 'EN only question',
            el: '',
            ru: 'Только русский вопрос',
          },
        }),
      ])
    );

    renderDetail();

    await waitFor(() =>
      expect(screen.getByTestId('culture-question-read-view')).toBeInTheDocument()
    );
    const readView = screen.getByTestId('culture-question-read-view');

    // EN + RU present, EL renders the '—' fallback (does not crash, does not blank).
    expect(readView).toHaveTextContent('EN only question');
    expect(readView).toHaveTextContent('Только русский вопрос');
    expect(readView).toHaveTextContent('—');
  });

  // ── 4. Fix 2 (CodeRabbit Minor): empty-string translations skip the fallback ─

  it('heading resolves to next language when the preferred language (EN) is an empty string', async () => {
    // Before the fix, `?? ` treats "" as present and resolves to "".
    // After the fix, firstNonEmpty skips "" and falls through to the EL value.
    (adminAPI.listCultureQuestions as Mock).mockResolvedValue(
      makeListResponse([
        makeQuestion({
          question_text: {
            en: '', // preferred is explicitly empty — should fall back, not blank the heading
            el: 'Ποιο είναι το εθνικό άθλημα;',
            ru: 'Какой национальный спорт?',
          },
        }),
      ])
    );

    renderDetail();

    await waitFor(() =>
      expect(screen.getByTestId('culture-question-detail-title')).toBeInTheDocument()
    );

    // The heading must show the EL value (next in the chain), not blank.
    expect(screen.getByTestId('culture-question-detail-title')).toHaveTextContent(
      'Ποιο είναι το εθνικό άθλημα;'
    );
  });

  it('answer text resolves to next language when the preferred language (EN) is an empty string', async () => {
    // Same ?? vs firstNonEmpty issue on the option text at line ~354.
    (adminAPI.listCultureQuestions as Mock).mockResolvedValue(
      makeListResponse([
        makeQuestion({
          option_a: { en: '', el: 'Ποδόσφαιρο', ru: 'Футбол' },
          option_b: { en: '', el: 'Μπάσκετ', ru: 'Баскетбол' },
        }),
      ])
    );

    renderDetail();

    await waitFor(() =>
      expect(screen.getByTestId('culture-question-read-view')).toBeInTheDocument()
    );

    // Options A and B must show the EL fallback, not blank.
    expect(screen.getByTestId('culture-question-read-answer-A')).toHaveTextContent('Ποδόσφαιρο');
    expect(screen.getByTestId('culture-question-read-answer-B')).toHaveTextContent('Μπάσκετ');
  });
});
