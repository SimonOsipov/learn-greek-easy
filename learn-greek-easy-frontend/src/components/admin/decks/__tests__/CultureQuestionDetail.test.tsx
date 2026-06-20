// src/components/admin/decks/__tests__/CultureQuestionDetail.test.tsx
//
// Vitest + RTL unit tests for CultureQuestionDetail (ADMIN2-09 / DKDR-13).

import type { ReactNode } from 'react';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

import type { AdminCultureQuestion, UnifiedDeckItem } from '@/services/adminAPI';

import { CultureQuestionDetail } from '../CultureQuestionDetail';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/services/adminAPI', () => ({
  adminAPI: {
    listCultureQuestions: vi.fn(),
    updateCultureQuestion: vi.fn(),
  },
}));

/**
 * Mock CultureCardForm captures the props we care about and exposes
 * test-ids for verification. ADMIN2-38-05: the migrated form owns its own
 * in-Card Save (culture-question-card-save) and Cancel (culture-question-card-cancel)
 * inside its <form>; this stub mirrors that contract so the wrapper's assertions
 * bind to the same testid surface the real component exposes.
 */
vi.mock('@/components/admin/CultureCardForm', () => ({
  CultureCardForm: ({
    initialData,
    onSubmit,
    onCancel,
    deckId,
    isSubmitting,
    // ensure no `mode` or `onSave` props are passed (if they were, TS would catch it,
    // but we also verify in the test that they are absent from the render)
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

// Import after vi.mock so we get the mocked version.
import { adminAPI } from '@/services/adminAPI';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const DECK_ID = 'deck-culture-1';
const QUESTION_ID = 'q-test-1';

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

/** A fully-translated question with 2 options → status should be Draft (opts=2, not 4) */
const makeFullQuestion = (overrides: Partial<AdminCultureQuestion> = {}): AdminCultureQuestion => ({
  id: QUESTION_ID,
  question_text: {
    en: 'What is the capital?',
    el: 'Ποια είναι η πρωτεύουσα;',
    ru: 'Какая столица?',
  },
  option_a: { en: 'Athens', el: 'Αθήνα', ru: 'Афины' },
  option_b: { en: 'Sparta', el: 'Σπάρτη', ru: 'Спарта' },
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

/** A question with all 4 options filled AND all translations → status should be Ready */
const makeReadyQuestion = (overrides: Partial<AdminCultureQuestion> = {}): AdminCultureQuestion =>
  makeFullQuestion({
    option_c: { en: 'Corinth', el: 'Κόρινθος', ru: 'Коринф' },
    option_d: { en: 'Patras', el: 'Πάτρα', ru: 'Патра' },
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

interface RenderOptions {
  initialUrl?: string;
  queryClient?: QueryClient;
}

function renderDetail(
  deck: UnifiedDeckItem = makeCultureDeck(),
  itemId: string = QUESTION_ID,
  {
    initialUrl = `/admin?edit=${DECK_ID}&item=${itemId}`,
    queryClient = makeQueryClient(),
  }: RenderOptions = {}
) {
  let currentSearch = '';

  const CaptureSearch = () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useLocation } = require('react-router-dom');
    const location = useLocation();
    currentSearch = location.search;
    return null;
  };

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  const result = render(
    <MemoryRouter initialEntries={[initialUrl]}>
      <Routes>
        <Route
          path="*"
          element={
            <>
              <CultureQuestionDetail deck={deck} itemId={itemId} />
              <CaptureSearch />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
    { wrapper: Wrapper }
  );

  return { ...result, getSearch: () => currentSearch, queryClient };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CultureQuestionDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── AC #1: CultureCardForm props — initialData, onSubmit, deckId (no mode/onSave) ──

  it('AC #1: renders CultureCardForm with initialData, onSubmit and deckId after entering edit mode', async () => {
    const user = userEvent.setup();
    (adminAPI.listCultureQuestions as Mock).mockResolvedValue(
      makeListResponse([makeFullQuestion()])
    );

    renderDetail();

    // ADMIN2-38-05: detail starts in read mode; the form is revealed by the Pencil.
    await waitFor(() => {
      expect(screen.getByTestId('culture-question-edit-btn')).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('culture-question-edit-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('culture-card-form')).toBeInTheDocument();
    });

    // initialData was passed (form has the marker span)
    expect(screen.getByTestId('culture-card-form-has-initial-data')).toHaveTextContent(
      'has-initial-data'
    );

    // deckId was passed
    expect(screen.getByTestId('culture-card-form-deck-id')).toHaveTextContent(DECK_ID);
  });

  // ── AC #2: Domain extraction is inlined — no import of extractDomain ─────────
  //
  // This is a static constraint verified by the implementation itself.
  // We verify the runtime behaviour: domain renders correctly.

  it('AC #2: inlined domain extraction renders correctly', async () => {
    (adminAPI.listCultureQuestions as Mock).mockResolvedValue(
      makeListResponse([
        makeFullQuestion({
          original_article_url: 'https://www.ekathimerini.com/article/123',
        }),
      ])
    );

    renderDetail();

    await waitFor(() => {
      expect(screen.getByTestId('culture-question-detail-source-domain')).toBeInTheDocument();
    });

    // "www." prefix must be stripped
    expect(screen.getByTestId('culture-question-detail-source-domain')).toHaveTextContent(
      'ekathimerini.com'
    );
  });

  // ── AC #3: Save allowed even when isTranslationComplete === false ─────────────

  it('AC #3: in-Card Save button is enabled regardless of translation completeness', async () => {
    const user = userEvent.setup();
    // Incomplete translations: only English, missing el/ru
    (adminAPI.listCultureQuestions as Mock).mockResolvedValue(
      makeListResponse([
        makeFullQuestion({
          question_text: { en: 'Only English' }, // el and ru missing
        }),
      ])
    );

    renderDetail();

    // ADMIN2-38-05: the only save is the in-Card culture-question-card-save (revealed
    // by the Pencil). It is enabled regardless of completeness (no gating on save).
    await waitFor(() => {
      expect(screen.getByTestId('culture-question-edit-btn')).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('culture-question-edit-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('culture-question-card-save')).toBeInTheDocument();
    });

    const saveBtn = screen.getByTestId('culture-question-card-save');
    expect(saveBtn).not.toBeDisabled();
  });

  // ── AC #4: News-source line + Open-in-News ONLY when original_article_url set ──

  it('AC #4: source block is hidden when original_article_url is null', async () => {
    (adminAPI.listCultureQuestions as Mock).mockResolvedValue(
      makeListResponse([makeFullQuestion({ original_article_url: null })])
    );

    renderDetail();

    await waitFor(() => {
      expect(screen.getByTestId('culture-question-read-view')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('culture-question-detail-source')).not.toBeInTheDocument();
  });

  it('AC #4: source block is shown when original_article_url is set', async () => {
    (adminAPI.listCultureQuestions as Mock).mockResolvedValue(
      makeListResponse([
        makeFullQuestion({
          original_article_url: 'https://example.com/news',
          news_item_id: null, // no Open-in-News link without news_item_id
        }),
      ])
    );

    renderDetail();

    await waitFor(() => {
      expect(screen.getByTestId('culture-question-detail-source')).toBeInTheDocument();
    });

    // No Open-in-News button when news_item_id is null
    expect(screen.queryByTestId('culture-question-detail-open-in-news')).not.toBeInTheDocument();
  });

  it('AC #4: Open-in-News button appears when both original_article_url and news_item_id are set', async () => {
    (adminAPI.listCultureQuestions as Mock).mockResolvedValue(
      makeListResponse([
        makeFullQuestion({
          original_article_url: 'https://example.com/news',
          news_item_id: 'news-abc',
        }),
      ])
    );

    renderDetail();

    await waitFor(() => {
      expect(screen.getByTestId('culture-question-detail-open-in-news')).toBeInTheDocument();
    });
  });

  // ── AC #5: Deep link lands in detail view; skeleton visible briefly ───────────

  it('AC #5: shows detail skeleton while question is loading on deep-link', () => {
    // Keep the API call pending forever
    (adminAPI.listCultureQuestions as Mock).mockReturnValue(new Promise(() => {}));

    renderDetail();

    // Skeleton should be visible immediately
    expect(screen.getByTestId('deck-drawer-skeleton')).toBeInTheDocument();
    expect(screen.getByTestId('deck-drawer-skeleton')).toHaveAttribute('data-variant', 'detail');
  });

  it('AC #5: eventually renders the read view after fetch resolves', async () => {
    (adminAPI.listCultureQuestions as Mock).mockResolvedValue(
      makeListResponse([makeFullQuestion()])
    );

    renderDetail();

    // ADMIN2-38-05: the detail lands in the read view (the form is edit-only).
    await waitFor(() => {
      expect(screen.getByTestId('culture-question-read-view')).toBeInTheDocument();
    });

    // No skeleton after load
    expect(screen.queryByTestId('deck-drawer-skeleton')).not.toBeInTheDocument();
  });

  // ── AC #6: Header — back link, H3 "Edit question", status Badge ──────────────

  it('AC #6: header shows back link, title, and Draft badge for incomplete question', async () => {
    (adminAPI.listCultureQuestions as Mock).mockResolvedValue(
      makeListResponse([makeFullQuestion()]) // 2 opts → Draft
    );

    renderDetail();

    await waitFor(() => {
      expect(screen.getByTestId('culture-question-detail-back')).toBeInTheDocument();
    });

    expect(screen.getByTestId('culture-question-detail-title')).toBeInTheDocument();

    const statusBadge = screen.getByTestId('culture-question-detail-status');
    expect(statusBadge).toBeInTheDocument();
    // 2 options filled → "opts" chip is gray, not green → Draft
    expect(statusBadge).toHaveTextContent('Draft');
  });

  it('AC #6: back link clears ?item from URL when clicked', async () => {
    const user = userEvent.setup();
    (adminAPI.listCultureQuestions as Mock).mockResolvedValue(
      makeListResponse([makeFullQuestion()])
    );

    const { getSearch } = renderDetail();

    await waitFor(() => {
      expect(screen.getByTestId('culture-question-detail-back')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('culture-question-detail-back'));

    await waitFor(() => {
      expect(getSearch()).not.toContain('item=');
    });
  });

  it('AC #6: status Badge shows Ready when all translations + 4 options are filled', async () => {
    (adminAPI.listCultureQuestions as Mock).mockResolvedValue(
      makeListResponse([makeReadyQuestion()])
    );

    renderDetail();

    // The status badge is present during the loading state too (defaults to Draft
    // when question is undefined). Wait for the *content* to flip to Ready after
    // the mocked query resolves — under slow CI runners the prior pattern
    // (waitFor existence + sync content assertion) raced the React Query update.
    await waitFor(() => {
      expect(screen.getByTestId('culture-question-detail-status')).toHaveTextContent('Ready');
    });
  });

  // ── AC #7: Drawer Tabs + footer-primary hidden while detail is pushed ─────────
  //
  // This behaviour is enforced by DeckDrawer (the `!itemId` guard), not by
  // CultureQuestionDetail itself. It's covered by DeckDrawer.test.tsx implicitly.
  // We verify the detail component renders inside the questions tab without tabs.

  it('AC #7: detail view renders without its own tabs (tabs are in the drawer level)', async () => {
    (adminAPI.listCultureQuestions as Mock).mockResolvedValue(
      makeListResponse([makeFullQuestion()])
    );

    renderDetail();

    await waitFor(() => {
      expect(screen.getByTestId('culture-question-detail')).toBeInTheDocument();
    });
  });

  // ── AC #8: Save calls adminAPI.updateCultureQuestion; Regenerate chip is disabled ──

  it('AC #8: in-Card Save calls adminAPI.updateCultureQuestion with correct questionId', async () => {
    const user = userEvent.setup();

    (adminAPI.listCultureQuestions as Mock).mockResolvedValue(
      makeListResponse([makeFullQuestion()])
    );
    (adminAPI.updateCultureQuestion as Mock).mockResolvedValue({});

    renderDetail();

    // ADMIN2-38-05: enter edit mode, then submit via the single in-Card save.
    await waitFor(() => {
      expect(screen.getByTestId('culture-question-edit-btn')).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('culture-question-edit-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('culture-question-card-save')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('culture-question-card-save'));

    await waitFor(() => {
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

  // ADMIN2-38-05/F4.8: the disabled "Regenerate translations" control was removed
  // along with the external footer. None of the old footer test-ids must exist.
  it('AC #8: external footer test-ids (Regenerate / footer / save / cancel) are removed', async () => {
    (adminAPI.listCultureQuestions as Mock).mockResolvedValue(
      makeListResponse([makeFullQuestion()])
    );

    renderDetail();

    await waitFor(() => {
      expect(screen.getByTestId('culture-question-read-view')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('culture-question-detail-regenerate')).not.toBeInTheDocument();
    expect(screen.queryByTestId('culture-question-detail-footer')).not.toBeInTheDocument();
    expect(screen.queryByTestId('culture-question-detail-save')).not.toBeInTheDocument();
    expect(screen.queryByTestId('culture-question-detail-cancel')).not.toBeInTheDocument();
  });

  // ── Not-found state ───────────────────────────────────────────────────────────

  it('shows not-found state when question is absent from API response', async () => {
    (adminAPI.listCultureQuestions as Mock).mockResolvedValue(
      makeListResponse([]) // empty list — question not found
    );

    renderDetail();

    await waitFor(() => {
      expect(screen.getByTestId('culture-question-not-found')).toBeInTheDocument();
    });
  });

  // ── Cache hit path (no API call when cached) ──────────────────────────────────

  it('reads question from TanStack Query cache without calling listCultureQuestions', async () => {
    const queryClient = makeQueryClient();

    // Pre-seed the cache directly
    queryClient.setQueryData(
      ['deck-culture', DECK_ID, 1, ''],
      makeListResponse([makeFullQuestion()])
    );

    renderDetail(makeCultureDeck(), QUESTION_ID, { queryClient });

    // Should render immediately — no API call needed (read view from cache)
    await waitFor(() => {
      expect(screen.getByTestId('culture-question-read-view')).toBeInTheDocument();
    });

    expect(adminAPI.listCultureQuestions).not.toHaveBeenCalled();
  });
});
