// src/components/admin/decks/__tests__/CultureDrawerBody.test.tsx
//
// Vitest + RTL unit tests for CultureDrawerBody (ADMIN2-09 / DKDR-12).

import type { ReactNode } from 'react';

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

import type {
  AdminCultureQuestion,
  AdminCultureQuestionsResponse,
  UnifiedDeckItem,
} from '@/services/adminAPI';

import { CultureDrawerBody } from '../CultureDrawerBody';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/services/adminAPI', () => ({
  adminAPI: {
    listCultureQuestions: vi.fn(),
    createCultureQuestion: vi.fn(),
    deleteCultureQuestion: vi.fn(),
  },
}));

vi.mock('@/components/admin/CardDeleteDialog', () => ({
  CardDeleteDialog: ({
    open,
    onConfirm,
  }: {
    open: boolean;
    onConfirm: () => void;
    onOpenChange: (v: boolean) => void;
    itemPreview: string;
    itemType: string;
    isDeleting: boolean;
  }) =>
    open ? (
      <div data-testid="card-delete-dialog">
        <button data-testid="card-delete-confirm" onClick={onConfirm}>
          Confirm
        </button>
      </div>
    ) : null,
}));

vi.mock('@/components/admin/CultureCardForm', () => ({
  CultureCardForm: ({
    onSubmit,
    deckId,
    initialData,
    isSubmitting,
  }: {
    onSubmit: (data: unknown) => Promise<void>;
    deckId?: string;
    initialData?: unknown;
    isSubmitting?: boolean;
  }) => (
    <div data-testid="culture-card-form">
      <span data-testid="culture-card-form-deck-id">{deckId}</span>
      {initialData !== undefined && (
        <span data-testid="culture-card-form-has-initial-data">has-initial-data</span>
      )}
      <span data-testid="culture-card-form-submitting">{String(isSubmitting ?? false)}</span>
      <button data-testid="culture-card-form-submit" onClick={() => onSubmit({ deck_id: deckId })}>
        Submit
      </button>
    </div>
  ),
}));

// Import after vi.mock so we get the mocked version.
import { adminAPI } from '@/services/adminAPI';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const DECK_ID = 'deck-culture-1';

/**
 * A "news question" — has news_item_id, so audio-a2 pill should be visible.
 */
const makeNewsQuestion = (overrides: Partial<AdminCultureQuestion> = {}): AdminCultureQuestion => ({
  id: 'q-news-1',
  question_text: {
    en: 'What is the capital of Greece?',
    el: 'Ποια είναι η πρωτεύουσα;',
    ru: 'Какая столица?',
  },
  option_a: { en: 'Athens', el: 'Αθήνα', ru: 'Афины' },
  option_b: { en: 'Thessaloniki', el: 'Θεσσαλονίκη', ru: 'Салоники' },
  option_c: null,
  option_d: null,
  correct_option: 1,
  source_article_url: 'https://example.com/article',
  is_pending_review: false,
  audio_s3_key: 'audio/q-news-1.mp3',
  news_item_id: 'news-abc',
  original_article_url: 'https://example.com/news',
  order_index: 1,
  news_item_audio_a2_s3_key: 'audio/a2-q-news-1.mp3',
  created_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

/**
 * An "exam question" — no news_item_id, so audio-a2 pill should be hidden.
 */
const makeExamQuestion = (overrides: Partial<AdminCultureQuestion> = {}): AdminCultureQuestion => ({
  id: 'q-exam-1',
  question_text: {
    en: 'Who wrote the Odyssey?',
    el: 'Ποιος έγραψε την Οδύσσεια;',
    ru: 'Кто написал Одиссею?',
  },
  option_a: { en: 'Homer', el: 'Όμηρος', ru: 'Гомер' },
  option_b: { en: 'Plato', el: 'Πλάτων', ru: 'Платон' },
  option_c: null,
  option_d: null,
  correct_option: 1,
  source_article_url: null,
  is_pending_review: false,
  audio_s3_key: null,
  news_item_id: null,
  original_article_url: null,
  order_index: 2,
  news_item_audio_a2_s3_key: null,
  created_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

const makeResponse = (
  questions: AdminCultureQuestion[],
  total = questions.length
): AdminCultureQuestionsResponse => ({
  questions,
  total,
  page: 1,
  page_size: 20,
  deck_id: DECK_ID,
});

const makeCultureDeck = (overrides: Partial<UnifiedDeckItem> = {}): UnifiedDeckItem => ({
  id: DECK_ID,
  name: { el: 'Ελληνική κουλτούρα', en: 'Greek Culture', ru: 'Греческая культура' },
  name_en: 'Greek Culture',
  name_ru: 'Греческая культура',
  type: 'culture',
  level: null,
  category: 'culture',
  item_count: 20,
  is_active: true,
  is_premium: false,
  is_system_deck: null,
  created_at: '2026-01-01T00:00:00Z',
  owner_id: null,
  owner_name: null,
  ...overrides,
});

// ── Render helpers ────────────────────────────────────────────────────────────

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

interface RenderOptions {
  initialUrl?: string;
}

function renderBody(
  deck: UnifiedDeckItem = makeCultureDeck(),
  { initialUrl = `/admin?edit=${DECK_ID}` }: RenderOptions = {}
) {
  const queryClient = makeQueryClient();

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  let currentSearch = '';

  const CaptureSearch = () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useLocation } = require('react-router-dom');
    const location = useLocation();
    currentSearch = location.search;
    return null;
  };

  const result = render(
    <MemoryRouter initialEntries={[initialUrl]}>
      <Routes>
        <Route
          path="*"
          element={
            <>
              <CultureDrawerBody deck={deck} />
              <CaptureSearch />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
    { wrapper: Wrapper }
  );

  return { ...result, queryClient, getSearch: () => currentSearch };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CultureDrawerBody', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 1. Calls listCultureQuestions on mount ────────────────────────────────

  it('calls adminAPI.listCultureQuestions with correct params on mount', async () => {
    (adminAPI.listCultureQuestions as Mock).mockResolvedValue(makeResponse([]));

    renderBody();

    await waitFor(() => {
      expect(adminAPI.listCultureQuestions).toHaveBeenCalledWith(DECK_ID, 1, 20, {
        search: undefined,
      });
    });
  });

  // ── 2. Renders one question-row per question ───────────────────────────────

  it('renders one question-row per question returned', async () => {
    (adminAPI.listCultureQuestions as Mock).mockResolvedValue(
      makeResponse([makeNewsQuestion(), makeExamQuestion()])
    );

    renderBody();

    await waitFor(() => {
      expect(screen.getAllByTestId('question-row')).toHaveLength(2);
    });
  });

  // ── 3. 6-pill order: EL → EN → RU → Opts → audio (B2|single) → A2 Audio ──
  //    News question has all pills visible; exam question hides audio-a2.

  it('news question shows audio-a2 pill; exam question hides it', async () => {
    const news = makeNewsQuestion({ id: 'q-news-pill' });
    const exam = makeExamQuestion({ id: 'q-exam-pill' });

    (adminAPI.listCultureQuestions as Mock).mockResolvedValue(makeResponse([news, exam]));

    renderBody();

    await waitFor(() => {
      expect(screen.getAllByTestId('question-row')).toHaveLength(2);
    });

    const rows = screen.getAllByTestId('question-row');
    const newsRow = rows.find((r) => within(r).queryByText('What is the capital of Greece?'));
    const examRow = rows.find((r) => within(r).queryByText('Who wrote the Odyssey?'));

    expect(newsRow).toBeTruthy();
    expect(examRow).toBeTruthy();

    // News question: audio-a2 pill should be visible
    expect(within(newsRow!).queryByTestId('completion-pill-audio-a2')).toBeInTheDocument();

    // Exam question: audio-a2 pill should NOT be present
    expect(within(examRow!).queryByTestId('completion-pill-audio-a2')).not.toBeInTheDocument();
  });

  // ── 4. News badge appears only when original_article_url is set ───────────

  it('shows News badge only when original_article_url is set', async () => {
    const withUrl = makeNewsQuestion({
      id: 'q-has-url',
      original_article_url: 'https://example.com',
    });
    const withoutUrl = makeExamQuestion({ id: 'q-no-url', original_article_url: null });

    (adminAPI.listCultureQuestions as Mock).mockResolvedValue(makeResponse([withUrl, withoutUrl]));

    renderBody();

    await waitFor(() => {
      expect(screen.getAllByTestId('question-row')).toHaveLength(2);
    });

    const rows = screen.getAllByTestId('question-row');
    const withUrlRow = rows.find((r) => within(r).queryByText('What is the capital of Greece?'));
    const withoutUrlRow = rows.find((r) => within(r).queryByText('Who wrote the Odyssey?'));

    expect(within(withUrlRow!).getByTestId('question-row-news-badge')).toBeInTheDocument();
    expect(within(withoutUrlRow!).queryByTestId('question-row-news-badge')).not.toBeInTheDocument();
  });

  // ── 5. Row body click pushes ?item=<questionId> ───────────────────────────

  it('clicking a question row pushes ?item=<questionId> to the URL', async () => {
    const user = userEvent.setup();
    const question = makeExamQuestion({ id: 'q-click-me' });
    (adminAPI.listCultureQuestions as Mock).mockResolvedValue(makeResponse([question]));

    const { getSearch } = renderBody(makeCultureDeck(), { initialUrl: `/admin?edit=${DECK_ID}` });

    await waitFor(() => {
      expect(screen.getByTestId('question-row')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('question-row'));

    await waitFor(() => {
      expect(getSearch()).toContain('item=q-click-me');
    });
  });

  // ── 6. Pencil click pushes ?item= (does NOT bubble to row handler twice) ──

  it('clicking pencil pushes ?item=<questionId> and does not navigate twice', async () => {
    const user = userEvent.setup();
    const question = makeExamQuestion({ id: 'q-pencil' });
    (adminAPI.listCultureQuestions as Mock).mockResolvedValue(makeResponse([question]));

    const { getSearch } = renderBody(makeCultureDeck(), { initialUrl: `/admin?edit=${DECK_ID}` });

    await waitFor(() => {
      expect(screen.getByTestId('question-row-edit')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('question-row-edit'));

    await waitFor(() => {
      expect(getSearch()).toContain('item=q-pencil');
    });
  });

  // ── 7. Trash click opens CardDeleteDialog without changing URL ─────────────

  it('clicking trash opens CardDeleteDialog without changing URL', async () => {
    const user = userEvent.setup();
    const question = makeExamQuestion({ id: 'q-trash' });
    (adminAPI.listCultureQuestions as Mock).mockResolvedValue(makeResponse([question]));

    const { getSearch } = renderBody(makeCultureDeck(), { initialUrl: `/admin?edit=${DECK_ID}` });

    await waitFor(() => {
      expect(screen.getByTestId('question-row-delete')).toBeInTheDocument();
    });

    const searchBefore = getSearch();
    await user.click(screen.getByTestId('question-row-delete'));

    await waitFor(() => {
      expect(screen.getByTestId('card-delete-dialog')).toBeInTheDocument();
    });

    // URL must NOT have changed to include ?item=
    expect(getSearch()).toBe(searchBefore);
    expect(getSearch()).not.toContain('item=q-trash');
  });

  // ── 8. "Add question" opens Dialog with CultureCardForm ───────────────────

  it('"Add question" button opens a Dialog containing CultureCardForm with correct props', async () => {
    const user = userEvent.setup();
    (adminAPI.listCultureQuestions as Mock).mockResolvedValue(makeResponse([]));

    renderBody();

    await waitFor(() => {
      expect(screen.getByTestId('question-list-add-question')).toBeInTheDocument();
    });

    // Dialog should not be open yet
    expect(screen.queryByTestId('culture-card-form')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('question-list-add-question'));

    await waitFor(() => {
      expect(screen.getByTestId('culture-card-form')).toBeInTheDocument();
    });

    // No initialData prop in create mode
    expect(screen.queryByTestId('culture-card-form-has-initial-data')).not.toBeInTheDocument();

    // deckId is passed
    expect(screen.getByTestId('culture-card-form-deck-id')).toHaveTextContent(DECK_ID);
  });

  // ── 9. Empty filtered state shows correct copy ────────────────────────────

  it('shows emptyQuestionsFilter copy when results are empty and search is applied', async () => {
    const user = userEvent.setup();
    (adminAPI.listCultureQuestions as Mock).mockResolvedValue(makeResponse([]));

    renderBody();

    await waitFor(() => {
      expect(screen.getByTestId('question-list-toolbar')).toBeInTheDocument();
    });

    const searchInput = screen.getByTestId('question-list-search');
    await user.type(searchInput, 'xyz');

    await waitFor(() => {
      expect(screen.getByTestId('question-list-empty')).toBeInTheDocument();
    });

    expect(screen.getByTestId('question-list-empty')).toHaveTextContent(
      'No questions match your filters.'
    );
  });

  // ── 10. Question text fallback chain ──────────────────────────────────────

  it('renders English question_text when present', async () => {
    const question = makeExamQuestion({
      question_text: { en: 'English text', el: 'Greek text', ru: 'Russian text' },
    });
    (adminAPI.listCultureQuestions as Mock).mockResolvedValue(makeResponse([question]));

    renderBody();

    await waitFor(() => {
      expect(screen.getByTestId('question-row')).toBeInTheDocument();
    });

    expect(screen.getByText('English text')).toBeInTheDocument();
  });

  it('falls back to Greek question_text when English is absent', async () => {
    const question = makeExamQuestion({
      question_text: { el: 'Greek text only', ru: 'Russian text' },
    });
    (adminAPI.listCultureQuestions as Mock).mockResolvedValue(makeResponse([question]));

    renderBody();

    await waitFor(() => {
      expect(screen.getByTestId('question-row')).toBeInTheDocument();
    });

    expect(screen.getByText('Greek text only')).toBeInTheDocument();
  });

  // ── 11. Stable testids present ────────────────────────────────────────────

  it('stable testids rendered: question-list-toolbar, question-list-search, question-row', async () => {
    (adminAPI.listCultureQuestions as Mock).mockResolvedValue(makeResponse([makeExamQuestion()]));

    renderBody();

    await waitFor(() => {
      expect(screen.getByTestId('question-list-toolbar')).toBeInTheDocument();
      expect(screen.getByTestId('question-list-search')).toBeInTheDocument();
      expect(screen.getByTestId('question-row')).toBeInTheDocument();
    });
  });
});
