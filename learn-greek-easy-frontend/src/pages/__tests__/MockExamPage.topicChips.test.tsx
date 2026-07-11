/**
 * MockExamPage — single-select topic chips (WEDGE-03-03)
 *
 * RED as of this commit: MockExamPage.tsx does not yet render a
 * `culture-topic-chips` group, any `topic-chip-*` chip, or a
 * `topic-practice-launcher`, and does not fetch `cultureDeckAPI.getList()`.
 * Every test below fails on `getByTestId('culture-topic-chips')` /
 * `getByTestId('topic-chip-*')` not being found — a clean assertion/query
 * failure, not a render crash or compile error. They go green once the
 * executor adds:
 *   - a `role="group"` chip row (testid `culture-topic-chips`) with 5
 *     `CULTURE_TOPICS` chips (testid `topic-chip-${topic}`) + an "All topics"
 *     clear chip (testid `topic-chip-all`), single-select via aria-pressed,
 *   - a `cultureDeckAPI.getList()` fetch (`useQuery(['cultureDecksList'])`)
 *     and a topic→deckId resolver (greatest `question_count` among decks
 *     matching `category === topic`, ascending-id tie-break),
 *   - a topic-scoped practice launcher (testid `topic-practice-launcher`)
 *     that navigates to `/culture/:deckId/practice?topic=<topic>` when
 *     resolved, and is disabled (no navigation) when unresolved,
 *   - `mockExam.topics.all` / `mockExam.topics.filterGroup` i18n keys (EN+RU),
 *     with chip labels reusing the existing `deck:culture.categories.*` keys.
 *
 * Covers (architect Test Specs table):
 * - AC2: five topic chips + "All topics" render
 * - AC2: selecting a chip is single-select (only one aria-pressed=true)
 * - AC2: tapping the active chip again clears back to all-topics
 * - AC2: the practice launcher targets the resolved deck + topic
 * - D-6a: topic→deck resolver picks the GREATEST question_count deck for the
 *   topic, not the first deck returned
 * - AC2: the launcher is disabled (no navigation) when the topic has no deck
 * - AC4: chip labels are localized in EN and RU
 * - AC2/OOS: chips render the plain label only — no "(count)" suffix
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import i18n from '@/i18n';
import { cleanup, render, screen, waitFor, within } from '@/lib/test-utils';
import type {
  CultureDeckListResponse,
  CultureDeckResponse,
  CultureReadinessResponse,
} from '@/services/cultureDeckAPI';
import { useMockExamSessionStore } from '@/stores/mockExamSessionStore';
import { CULTURE_TOPICS } from '@/types/culture';
import type { MockExamStatisticsResponse, MockExamQueueResponse } from '@/types/mockExam';

import { MockExamPage } from '../MockExamPage';

// Mock react-router-dom — spy on useNavigate, keep everything else real
// (including <Link>, <BrowserRouter> used by the render wrapper).
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock analytics — MockExamPage tracks a page-view event on stats settle.
vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
  registerTheme: vi.fn(),
  registerInterfaceLanguage: vi.fn(),
}));

// Mock logger.
vi.mock('@/lib/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Mock the mock-exam API — MockExamPage's pre-existing statistics + queue
// queries (App.tsx: /practice/culture-exam).
const mockGetStatistics = vi.fn();
const mockGetQuestionQueue = vi.fn();

vi.mock('@/services/mockExamAPI', () => ({
  mockExamAPI: {
    getStatistics: (...args: unknown[]) => mockGetStatistics(...args),
    getQuestionQueue: (...args: unknown[]) => mockGetQuestionQueue(...args),
    createSession: vi.fn(),
    submitAll: vi.fn(),
    abandonSession: vi.fn(),
  },
}));

// Mock the culture deck API — getReadiness (pre-existing) + getList (the
// WEDGE-03-03 decks-list fetch that feeds the topic→deck resolver, D-6a).
const mockGetReadiness = vi.fn();
const mockGetList = vi.fn();

vi.mock('@/services/cultureDeckAPI', () => ({
  cultureDeckAPI: {
    getReadiness: (...args: unknown[]) => mockGetReadiness(...args),
    getList: (...args: unknown[]) => mockGetList(...args),
  },
}));

// Real react-i18next + the real i18n singleton (registered with all
// namespaces incl. `mockExam` and `deck` in src/lib/test-setup.ts) are used
// here, deliberately NOT mocked — the AC4 localization test needs real
// EN/RU strings, and every `mockExam.*` key MockExamPage currently reads
// (page.*, breadcrumb.*, readiness.*, ...) already exists in the real
// locale files, so this renders cleanly pre-implementation too.

// ── Fixtures ────────────────────────────────────────────────────────────

function makeStats(overrides?: Partial<MockExamStatisticsResponse>): MockExamStatisticsResponse {
  return {
    stats: {
      total_exams: 5,
      passed_exams: 3,
      pass_rate: 60,
      average_score: 72,
      best_score: 88,
      total_questions_answered: 125,
      average_time_seconds: 1800,
    },
    recent_exams: [],
    ...overrides,
  };
}

function makeQueue(overrides?: Partial<MockExamQueueResponse>): MockExamQueueResponse {
  return {
    total_questions: 25,
    available_questions: 25,
    can_start_exam: true,
    sample_questions: [],
    ...overrides,
  };
}

function makeReadiness(overrides?: Partial<CultureReadinessResponse>): CultureReadinessResponse {
  return {
    readiness_percentage: 0,
    verdict: 'not_ready',
    questions_learned: 0,
    questions_total: 0,
    accuracy_percentage: null,
    total_answers: 0,
    categories: [],
    motivation: null,
    current_streak: 0,
    ...overrides,
  };
}

/** Real culture-deck-list item shape (cultureDeckAPI.ts CultureDeckResponse). */
function makeDeck(
  overrides: Partial<CultureDeckResponse> & Pick<CultureDeckResponse, 'id' | 'category'>
): CultureDeckResponse {
  return {
    name: `${overrides.category} deck`,
    description: null,
    question_count: 10,
    ...overrides,
  };
}

function makeDeckList(decks: CultureDeckResponse[]): CultureDeckListResponse {
  return { decks, total: decks.length };
}

/** One deck per CULTURE_TOPICS category — a "fully resolvable" baseline. */
const DEFAULT_DECKS: CultureDeckResponse[] = [
  makeDeck({ id: 'd-hist', category: 'history', question_count: 50 }),
  makeDeck({ id: 'd-geo', category: 'geography', question_count: 30 }),
  makeDeck({ id: 'd-pol', category: 'politics', question_count: 20 }),
  makeDeck({ id: 'd-cul', category: 'culture', question_count: 15 }),
  makeDeck({ id: 'd-prac', category: 'practical', question_count: 25 }),
];

describe('MockExamPage — topic chips (WEDGE-03-03)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();

    mockGetStatistics.mockResolvedValue(makeStats());
    mockGetQuestionQueue.mockResolvedValue(makeQueue());
    mockGetReadiness.mockResolvedValue(makeReadiness());
    mockGetList.mockResolvedValue(makeDeckList(DEFAULT_DECKS));

    useMockExamSessionStore.setState({
      session: null,
      summary: null,
      isLoading: false,
      error: null,
      hasRecoverableSession: false,
      currentQuestion: null,
      progress: { current: 0, total: 0 },
      hasNextQuestion: false,
      checkRecoverableSession: vi.fn(),
    } as any);
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('en');
  });

  /** Render and wait for the initial-load skeleton to clear. */
  async function renderSettled() {
    render(<MockExamPage />);
    await screen.findByTestId('start-exam-button');
  }

  // ---------------------------------------------------------------------
  // AC2 — five topic chips + "All topics"
  // ---------------------------------------------------------------------

  it('renders five topic chips plus an "All topics" chip', async () => {
    await renderSettled();

    const group = screen.getByTestId('culture-topic-chips');
    const chips = within(group).getAllByTestId(/^topic-chip-/);

    // 5 CULTURE_TOPICS chips + 1 "All topics" clear chip.
    expect(chips).toHaveLength(CULTURE_TOPICS.length + 1);

    for (const topic of CULTURE_TOPICS) {
      expect(within(group).getByTestId(`topic-chip-${topic}`)).toBeInTheDocument();
    }
    expect(within(group).getByTestId('topic-chip-all')).toBeInTheDocument();
  });

  // ---------------------------------------------------------------------
  // AC2 — single-select
  // ---------------------------------------------------------------------

  it('selecting a chip activates it and deactivates the previous selection (single-select)', async () => {
    await renderSettled();
    const group = screen.getByTestId('culture-topic-chips');

    const historyChip = within(group).getByTestId('topic-chip-history');
    const politicsChip = within(group).getByTestId('topic-chip-politics');

    historyChip.click();
    expect(historyChip).toHaveAttribute('aria-pressed', 'true');
    expect(politicsChip).toHaveAttribute('aria-pressed', 'false');

    politicsChip.click();
    expect(historyChip).toHaveAttribute('aria-pressed', 'false');
    expect(politicsChip).toHaveAttribute('aria-pressed', 'true');
  });

  // ---------------------------------------------------------------------
  // AC2 — tapping the active chip clears to all-topics
  // ---------------------------------------------------------------------

  it('tapping the active chip again clears the selection back to all-topics', async () => {
    await renderSettled();
    const group = screen.getByTestId('culture-topic-chips');

    const historyChip = within(group).getByTestId('topic-chip-history');
    const allChip = within(group).getByTestId('topic-chip-all');

    historyChip.click();
    expect(historyChip).toHaveAttribute('aria-pressed', 'true');

    historyChip.click();
    for (const topic of CULTURE_TOPICS) {
      expect(within(group).getByTestId(`topic-chip-${topic}`)).toHaveAttribute(
        'aria-pressed',
        'false'
      );
    }
    expect(allChip).toHaveAttribute('aria-pressed', 'true');
  });

  // ---------------------------------------------------------------------
  // AC2 — practice launcher carries deck + topic
  // ---------------------------------------------------------------------

  it('the topic-scoped practice launcher targets the resolved deck + topic', async () => {
    await renderSettled();
    const group = screen.getByTestId('culture-topic-chips');

    within(group).getByTestId('topic-chip-history').click();

    // DEFAULT_DECKS resolves history → d-hist (the only history deck).
    const launcher = await screen.findByTestId('topic-practice-launcher');
    await waitFor(() => expect(launcher).not.toBeDisabled());

    launcher.click();

    expect(mockNavigate).toHaveBeenCalledWith('/culture/d-hist/practice?topic=history');
  });

  // ---------------------------------------------------------------------
  // D-6a — resolver picks the GREATEST question_count deck, not the first
  // ---------------------------------------------------------------------

  it('resolves the culture topic to the deck with the greatest question_count (not the first returned)', async () => {
    // The highest-count deck (c-cy, 91) is placed in the MIDDLE of the list —
    // a resolver that (incorrectly) picks deck_ids[0] / the first match would
    // resolve to c-past-1 (24) instead.
    const cultureDecks: CultureDeckResponse[] = [
      makeDeck({ id: 'c-past-1', category: 'culture', question_count: 24 }),
      makeDeck({ id: 'c-past-2', category: 'culture', question_count: 20 }),
      makeDeck({ id: 'c-cy', category: 'culture', question_count: 91, name: 'Cyprus Culture' }),
      makeDeck({ id: 'c-past-3', category: 'culture', question_count: 18 }),
      makeDeck({ id: 'c-past-4', category: 'culture', question_count: 12 }),
      makeDeck({ id: 'c-past-5', category: 'culture', question_count: 5 }),
    ];
    mockGetList.mockResolvedValue(
      makeDeckList([...DEFAULT_DECKS.filter((d) => d.category !== 'culture'), ...cultureDecks])
    );

    await renderSettled();
    const group = screen.getByTestId('culture-topic-chips');

    within(group).getByTestId('topic-chip-culture').click();

    const launcher = await screen.findByTestId('topic-practice-launcher');
    await waitFor(() => expect(launcher).not.toBeDisabled());

    launcher.click();

    expect(mockNavigate).toHaveBeenCalledWith('/culture/c-cy/practice?topic=culture');
  });

  // ---------------------------------------------------------------------
  // AC2 — launcher disabled when the topic has no deck
  // ---------------------------------------------------------------------

  it('disables the practice launcher (no navigation) when the selected topic has no deck', async () => {
    mockGetList.mockResolvedValue(
      makeDeckList(DEFAULT_DECKS.filter((d) => d.category !== 'practical'))
    );

    await renderSettled();
    const group = screen.getByTestId('culture-topic-chips');

    within(group).getByTestId('topic-chip-practical').click();

    const launcher = await screen.findByTestId('topic-practice-launcher');
    await waitFor(() => expect(launcher).toBeDisabled());

    launcher.click();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------
  // AC4 — localized chip labels (EN + RU)
  // ---------------------------------------------------------------------

  it('renders chip labels in English, then in Russian after i18n.changeLanguage', async () => {
    await renderSettled();
    let group = screen.getByTestId('culture-topic-chips');

    expect(within(group).getByTestId('topic-chip-history')).toHaveTextContent('History');
    expect(within(group).getByTestId('topic-chip-geography')).toHaveTextContent('Geography');
    expect(within(group).getByTestId('topic-chip-politics')).toHaveTextContent('Politics');
    expect(within(group).getByTestId('topic-chip-culture')).toHaveTextContent('Culture');
    expect(within(group).getByTestId('topic-chip-practical')).toHaveTextContent('Practical');
    expect(within(group).getByTestId('topic-chip-all')).toHaveTextContent('All topics');

    cleanup();
    await i18n.changeLanguage('ru');
    await renderSettled();
    group = screen.getByTestId('culture-topic-chips');

    expect(within(group).getByTestId('topic-chip-history')).toHaveTextContent('История');
    expect(within(group).getByTestId('topic-chip-geography')).toHaveTextContent('География');
    expect(within(group).getByTestId('topic-chip-politics')).toHaveTextContent('Политика');
    expect(within(group).getByTestId('topic-chip-culture')).toHaveTextContent('Культура');
    expect(within(group).getByTestId('topic-chip-practical')).toHaveTextContent('Практика');
    expect(within(group).getByTestId('topic-chip-all')).toHaveTextContent('Все темы');
  });

  // ---------------------------------------------------------------------
  // AC2/OOS — no per-topic count suffix
  // ---------------------------------------------------------------------

  it('renders chips with the plain label only — no "(count)" suffix', async () => {
    await renderSettled();
    const group = screen.getByTestId('culture-topic-chips');

    const chips = within(group).getAllByTestId(/^topic-chip-/);
    expect(chips.length).toBeGreaterThan(0);

    for (const chip of chips) {
      // Guards the "no per-topic counts" out-of-scope boundary — a chip
      // carrying a "(N)" suffix (like FilterPills' `{label} ({count})`
      // pattern) would fail this.
      expect(chip.textContent ?? '').not.toMatch(/[(]|\d/);
    }
  });
});
