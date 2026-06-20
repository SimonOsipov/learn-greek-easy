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

  it('read view renders the "—" fallback for a blank language slot and switches one language at a time', async () => {
    // ADMIN2-39-03 F4: the read view now shows ONE language at a time (default EL)
    // via the EL·EN·RU switcher, instead of stacking all three. With a blank EL
    // question the default (EL) view shows the '—' fallback; switching to EN / RU
    // surfaces each value in turn (and proves no crash on the blank slot).
    const user = userEvent.setup();
    (adminAPI.listCultureQuestions as Mock).mockResolvedValue(
      makeListResponse([
        makeQuestion({
          // EL question text blank → default (EL) view must show the em-dash fallback.
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

    // Default language is EL → blank slot renders the '—' fallback (does not crash).
    expect(screen.getByTestId('culture-question-read-text')).toHaveTextContent('—');

    // Switch to EN → only the EN value is shown.
    await user.click(screen.getByTestId('culture-read-lang-en'));
    expect(screen.getByTestId('culture-question-read-text')).toHaveTextContent('EN only question');

    // Switch to RU → only the RU value is shown.
    await user.click(screen.getByTestId('culture-read-lang-ru'));
    expect(screen.getByTestId('culture-question-read-text')).toHaveTextContent(
      'Только русский вопрос'
    );
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

// ── ADMIN2-39-03 QA edge coverage (Mode B adversarial) ────────────────────────
//
// The executor's only F4/F5 test was the realigned "blank language slot" test
// (#3 above), which proves the switcher rewires the QUESTION text and the '—'
// fallback. It does NOT prove: (a) the EL-first default + the aria-selected
// tablist contract (AC-1), (b) that switching language rewires the ANSWER text
// too — not just the question (AC-2 from the interaction side), or (c) that the
// correct option carries the Situations correct-state marker while a non-correct
// option stays neutral with NO 0.35 dimming (AC-4). These four tests close those
// gaps against the live AnswerOption render (no mock — real practice styling).

describe('CultureQuestionDetail — ADMIN2-39-03 F4/F5 QA edge coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── AC-1: EL-first default + accessible tablist contract ──────────────────

  it('AC-1: default active language is EL (Greek-first); EL tab aria-selected=true, EN/RU false', async () => {
    (adminAPI.listCultureQuestions as Mock).mockResolvedValue(makeListResponse([makeQuestion()]));

    renderDetail();

    await waitFor(() =>
      expect(screen.getByTestId('culture-question-read-view')).toBeInTheDocument()
    );

    // The tablist exists with the accessible role.
    expect(screen.getByTestId('culture-read-lang-tabs')).toHaveAttribute('role', 'tablist');

    const elTab = screen.getByTestId('culture-read-lang-el');
    const enTab = screen.getByTestId('culture-read-lang-en');
    const ruTab = screen.getByTestId('culture-read-lang-ru');

    // Each tab carries role="tab".
    expect(elTab).toHaveAttribute('role', 'tab');
    expect(enTab).toHaveAttribute('role', 'tab');
    expect(ruTab).toHaveAttribute('role', 'tab');

    // Greek-first: EL is the selected default, EN/RU are not.
    expect(elTab).toHaveAttribute('aria-selected', 'true');
    expect(enTab).toHaveAttribute('aria-selected', 'false');
    expect(ruTab).toHaveAttribute('aria-selected', 'false');

    // …and the active EL tab carries the .is-active visual modifier (F2 convention).
    expect(elTab).toHaveClass('drawer-tab', 'is-active');
    expect(enTab).not.toHaveClass('is-active');

    // The default question text is the EL value (one language at a time).
    expect(screen.getByTestId('culture-question-read-text')).toHaveTextContent(
      'Ποιο είναι το εθνικό άθλημα της Ελλάδας;'
    );
  });

  // ── AC-1 / AC-2: tab order is EL, EN, RU left-to-right ─────────────────────

  it('AC-1: switcher renders the tabs in EL, EN, RU order', async () => {
    (adminAPI.listCultureQuestions as Mock).mockResolvedValue(makeListResponse([makeQuestion()]));

    renderDetail();

    await waitFor(() => expect(screen.getByTestId('culture-read-lang-tabs')).toBeInTheDocument());

    const tabs = within(screen.getByTestId('culture-read-lang-tabs')).getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['EL', 'EN', 'RU']);
  });

  // ── AC-2: switching language rewires BOTH question AND answer text ──────────

  it('AC-2: clicking RU rewires both the question text and the answer texts (and aria-selected moves)', async () => {
    const user = userEvent.setup();
    (adminAPI.listCultureQuestions as Mock).mockResolvedValue(makeListResponse([makeQuestion()]));

    renderDetail();

    await waitFor(() =>
      expect(screen.getByTestId('culture-question-read-view')).toBeInTheDocument()
    );

    // Default (EL): question + answer A render the Greek values; Russian not shown.
    expect(screen.getByTestId('culture-question-read-text')).toHaveTextContent(
      'Ποιο είναι το εθνικό άθλημα της Ελλάδας;'
    );
    expect(screen.getByTestId('culture-question-read-answer-A')).toHaveTextContent('Ποδόσφαιρο');
    expect(screen.getByTestId('culture-question-read-answer-A')).not.toHaveTextContent('Футбол');

    // Switch to RU.
    await user.click(screen.getByTestId('culture-read-lang-ru'));

    // BOTH the question and the answers now render the RU values…
    expect(screen.getByTestId('culture-question-read-text')).toHaveTextContent(
      'Какой национальный спорт Греции?'
    );
    expect(screen.getByTestId('culture-question-read-answer-A')).toHaveTextContent('Футбол');
    expect(screen.getByTestId('culture-question-read-answer-B')).toHaveTextContent('Баскетбол');

    // …and the EL values are no longer displayed (one language at a time).
    const readView = screen.getByTestId('culture-question-read-view');
    expect(readView).not.toHaveTextContent('Ποιο είναι το εθνικό άθλημα της Ελλάδας;');
    expect(readView).not.toHaveTextContent('Ποδόσφαιρο');

    // aria-selected moved to RU.
    expect(screen.getByTestId('culture-read-lang-ru')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('culture-read-lang-el')).toHaveAttribute('aria-selected', 'false');
  });

  // ── AC-4: Situations correct treatment on the correct row only; no dimming ──

  it('AC-4: correct option carries the Situations correct marker; non-correct option is neutral with NO 0.35 dimming and no "Correct" pill', async () => {
    // correct_option:1 → option A is correct, option B is not.
    (adminAPI.listCultureQuestions as Mock).mockResolvedValue(
      makeListResponse([makeQuestion({ correct_option: 1 })])
    );

    renderDetail();

    await waitFor(() =>
      expect(screen.getByTestId('culture-question-read-view')).toBeInTheDocument()
    );

    const answerA = screen.getByTestId('culture-question-read-answer-A'); // correct
    const answerB = screen.getByTestId('culture-question-read-answer-B'); // non-correct

    // Correct row: AnswerOption renders state="correct" → the green Check result icon
    // (result-icon-correct) and the practice-correct border. Non-correct row: neither.
    expect(within(answerA).getByTestId('result-icon-correct')).toBeInTheDocument();
    expect(within(answerB).queryByTestId('result-icon-correct')).not.toBeInTheDocument();

    // The correct AnswerOption button carries the Situations correct treatment classes.
    const correctBtn = within(answerA).getByTestId('answer-option-a');
    expect(correctBtn).toHaveClass('border-practice-correct', 'bg-practice-correct-soft');

    // Non-correct AnswerOption is the neutral default — NOT the dimmed (submitted)
    // treatment. The 0.35-opacity dimming class must be absent (D-F5-state).
    const neutralBtn = within(answerB).getByTestId('answer-option-b');
    expect(neutralBtn).toHaveClass('border-practice-border', 'bg-practice-card');
    expect(neutralBtn.className).not.toMatch(/opacity-\[0\.35\]/);
    expect(neutralBtn).not.toHaveClass('border-practice-correct');

    // The behavioural correct marker is preserved on the correct row, and the old
    // visible green "Correct" Badge pill is gone (no longer rendered).
    expect(within(answerA).getByTestId('culture-question-read-correct')).toBeInTheDocument();
    const readView = screen.getByTestId('culture-question-read-view');
    expect(readView).not.toHaveTextContent('Correct'); // no visible pill text
  });
});
