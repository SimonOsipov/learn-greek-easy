/**
 * ExercisePreSessionPage Smoke Tests — PRACT2-12-03 + PRACT2-12-06
 *
 * Render-smoke assertions: each red-dot (unbacked) panel renders a
 * data-testid="unwired-dot" element (no-crash + honest-placeholder guard).
 *
 * Does NOT assert pixel layout or exact copy — the Phase 3.5 visual gate
 * handles those. These tests only guard against:
 *   1. Component crashes with empty/null data
 *   2. Missing UnwiredDot on each unbacked panel
 *
 * Also asserts the REAL Recommended panel renders (empty state or cards)
 * and the Current streak metric wires to real data.
 *
 * PRACT2-12-06 adds: completion banner show/dismiss/guard specs (RED first).
 */

import { createElement } from 'react';

import { QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { screen, waitFor, render as rtlRender } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';

import i18n from '@/i18n';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { createTestQueryClient, renderWithProviders } from '@/lib/test-utils';
import { useExercisePracticeStore } from '@/stores/exercisePracticeStore';

import { ExercisePreSessionPage } from '../ExercisePreSessionPage';

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn() };
});

// exerciseAPI.getQueue — returns an empty queue by default
const mockGetQueue = vi.fn();
vi.mock('@/services/exerciseAPI', () => ({
  exerciseAPI: {
    getQueue: (...args: unknown[]) => mockGetQueue(...args),
  },
}));

// useStudyStreak — returns real-shaped data
const mockStreakValue = { currentStreak: 5, longestStreak: 12 };
vi.mock('@/hooks/useStudyStreak', () => ({
  useStudyStreak: () => ({ streak: mockStreakValue, loading: false, error: null }),
}));

// Silence posthog
vi.mock('posthog-js', () => ({ default: { capture: vi.fn() } }));

const emptyQueue = {
  total_due: 0,
  total_new: 0,
  total_early_practice: 0,
  total_in_queue: 0,
  exercises: [],
};

// ─── Render helper with QueryClient ────────────────────────────────────────

function renderPage() {
  const queryClient = createTestQueryClient();
  const PageWithQuery = () =>
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(ExercisePreSessionPage)
    );
  return renderWithProviders(createElement(PageWithQuery));
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('ExercisePreSessionPage — red-dot panels smoke tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetQueue.mockResolvedValue(emptyQueue);
  });

  it('renders without crashing when queue is empty', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('exercise-pre-session-page')).toBeInTheDocument();
    });
  });

  it('accuracy-over-time panel renders an UnwiredDot', async () => {
    renderPage();
    await waitFor(() => {
      const panel = screen.getByTestId('panel-accuracy-chart');
      expect(panel.querySelector('[data-testid="unwired-dot"]')).toBeInTheDocument();
    });
  });

  it('goal-ring panel renders an UnwiredDot', async () => {
    renderPage();
    await waitFor(() => {
      const panel = screen.getByTestId('panel-goal-ring');
      expect(panel.querySelector('[data-testid="unwired-dot"]')).toBeInTheDocument();
    });
  });

  it('weak-spots panel renders an UnwiredDot', async () => {
    renderPage();
    await waitFor(() => {
      const panel = screen.getByTestId('panel-weak-spots');
      expect(panel.querySelector('[data-testid="unwired-dot"]')).toBeInTheDocument();
    });
  });

  it('recent-sessions panel renders an UnwiredDot', async () => {
    renderPage();
    await waitFor(() => {
      const panel = screen.getByTestId('panel-recent-sessions');
      expect(panel.querySelector('[data-testid="unwired-dot"]')).toBeInTheDocument();
    });
  });

  it('metric-strip: at least 3 red-dot metrics (Accuracy, Exercises done, Time practiced)', async () => {
    renderPage();
    await waitFor(() => {
      const strip = screen.getByTestId('metric-strip');
      const dots = strip.querySelectorAll('[data-testid="unwired-dot"]');
      expect(dots.length).toBeGreaterThanOrEqual(3);
    });
  });

  it('metric-strip: Current streak shows real data (not an UnwiredDot)', async () => {
    renderPage();
    await waitFor(() => {
      const streakEl = screen.getByTestId('current-streak-value');
      // Should contain the streak number "5"
      expect(streakEl.textContent).toContain('5');
    });
  });

  it('recommended panel renders empty state when queue is empty', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('recommended-empty')).toBeInTheDocument();
    });
  });

  it('recommended panel renders cards when queue has exercises', async () => {
    const queueWithItems = {
      total_due: 1,
      total_new: 0,
      total_early_practice: 0,
      total_in_queue: 1,
      exercises: [
        {
          exercise_id: 'ex-1',
          source_type: 'description' as const,
          exercise_type: 'select_correct_answer' as const,
          modality: 'reading' as const,
          audio_level: 'A1' as const,
          status: 'new' as const,
          is_new: true,
          is_early_practice: false,
          due_date: null,
          easiness_factor: null,
          interval: null,
          situation_id: null,
          scenario_el: 'Στο σπίτι',
          scenario_en: 'At home',
          scenario_ru: null,
          description_text_el: null,
          description_audio_url: null,
          description_audio_duration: null,
          word_timestamps: null,
          items: [{ item_index: 0, payload: { correct_answer_index: 0, options: ['a'] } }],
        },
      ],
    };
    mockGetQueue.mockResolvedValue(queueWithItems);

    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('recommended-grid')).toBeInTheDocument();
      expect(screen.getByTestId('recommended-card')).toBeInTheDocument();
    });
  });

  it('skill-families panel has UnwiredDots for all 4 family rows', async () => {
    renderPage();
    await waitFor(() => {
      const panel = screen.getByTestId('panel-skill-families');
      const dots = panel.querySelectorAll('[data-testid="unwired-dot"]');
      // 4 family rows × 1 UnwiredDot each
      expect(dots.length).toBeGreaterThanOrEqual(4);
    });
  });
});

// ─── PRACT2-12-06: Completion banner (RED specs) ────────────────────────────
//
// DOM contract the executor MUST implement:
//   • Banner root:        data-testid="xd-completion-banner"
//   • Dismiss control:    <button> whose accessible name matches /dismiss/i
//   • Practice again:     <button> whose accessible name matches /practice again/i
//   • Correct count:      the number 4 appears in the banner (e.g. data-testid or text)
//   • Missed count:       the number 1 appears in the banner (missed = total − correct = 5 − 4)
//   • Binary split only:  NO partial count; only correct + missed
//
// Guard contract (Decision 6 — route-state only, no new store field):
//   • Banner shows IFF sessionSummary !== null AND location.state.fromFinish === true
//   • Organic visit (no route-state) → no banner even when sessionSummary is set
//   • Null summary + fromFinish → no banner

describe('completion banner (PRACT2-12-06)', () => {
  // A realistic session summary: 5 total, 4 correct, 1 missed, 80% accuracy
  const fullSummary = {
    total: 5,
    correct: 4,
    accuracy_pct: 80,
    duration_seconds: 120,
  };

  // Render the overview page inside a MemoryRouter whose initial entry carries
  // route-state — the same shape the session page will use when navigating on finish.
  // Wraps all required providers but uses MemoryRouter directly (not renderWithProviders
  // which uses BrowserRouter and cannot carry initialEntries route-state).
  function renderWithRouteState(
    routeState: { fromFinish: boolean } | null,
    queryClient = createTestQueryClient()
  ) {
    const initialEntry = routeState
      ? { pathname: '/practice/exercises', state: routeState }
      : '/practice/exercises';

    return rtlRender(
      <I18nextProvider i18n={i18n}>
        <LanguageProvider>
          <ThemeProvider>
            <QueryClientProvider client={queryClient}>
              <MemoryRouter initialEntries={[initialEntry]}>
                <Routes>
                  <Route path="/practice/exercises" element={<ExercisePreSessionPage />} />
                  <Route path="/practice/exercises/session" element={<div>Session</div>} />
                </Routes>
              </MemoryRouter>
            </QueryClientProvider>
          </ThemeProvider>
        </LanguageProvider>
      </I18nextProvider>
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset exercise store to initial state before each test
    useExercisePracticeStore.setState({
      sessionSummary: null,
    });
    // Keep the existing exerciseAPI mock returning an empty queue
    mockGetQueue.mockResolvedValue(emptyQueue);
  });

  // ── AC-show: banner renders on finish arrival with summary ──────────────────
  it('banner shows when arriving from finish with summary', async () => {
    // Given: sessionSummary is set in the store
    useExercisePracticeStore.setState({ sessionSummary: fullSummary });

    // When: overview mounts with fromFinish route-state
    renderWithRouteState({ fromFinish: true });

    // Then: the banner is present
    await waitFor(() => {
      expect(screen.getByTestId('xd-completion-banner')).toBeInTheDocument();
    });

    // And: it shows the BINARY correct count (4) and missed count (1 = total − correct)
    const banner = screen.getByTestId('xd-completion-banner');
    expect(banner).toHaveTextContent('4'); // correct
    expect(banner).toHaveTextContent('1'); // missed = 5 − 4

    // And: it does NOT show a third "partial" bucket (no 3-way split)
    // Verify by confirming the two visible counts are 4 and 1, not 3 distinct non-zero numbers
    // The banner should have Dismiss and Practice again controls
    expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /practice again/i })).toBeInTheDocument();
  });

  // ── AC-dismiss: clicking Dismiss calls clearSessionSummary and removes banner ──
  it('Dismiss clears summary and removes banner', async () => {
    const user = userEvent.setup();

    // Given: summary set + fromFinish route-state → banner is visible
    useExercisePracticeStore.setState({ sessionSummary: fullSummary });
    renderWithRouteState({ fromFinish: true });

    await waitFor(() => {
      expect(screen.getByTestId('xd-completion-banner')).toBeInTheDocument();
    });

    // When: user clicks Dismiss
    const dismissBtn = screen.getByRole('button', { name: /dismiss/i });
    await user.click(dismissBtn);

    // Then: clearSessionSummary was called — store sessionSummary is now null
    await waitFor(() => {
      expect(useExercisePracticeStore.getState().sessionSummary).toBeNull();
    });

    // And: the banner is gone from the DOM
    expect(screen.queryByTestId('xd-completion-banner')).not.toBeInTheDocument();
  });

  // ── AC-guard (1): null summary → no banner even with fromFinish ─────────────
  it('no banner on organic visit when sessionSummary is null', async () => {
    // Given: sessionSummary is null (no finished session in store)
    useExercisePracticeStore.setState({ sessionSummary: null });

    // When: overview mounts WITH fromFinish route-state (as if user navigated here manually)
    renderWithRouteState({ fromFinish: true });

    await waitFor(() => {
      expect(screen.getByTestId('exercise-pre-session-page')).toBeInTheDocument();
    });

    // Then: no banner rendered — null summary is the primary guard
    expect(screen.queryByTestId('xd-completion-banner')).not.toBeInTheDocument();
  });

  // ── AC-guard (2): summary set but no fromFinish route-state → no banner ─────
  // This is the key D6 test: proves the route-state guard (not just the summary) controls
  // visibility — a stale summary from a prior session must NOT re-show on a later
  // organic visit to /practice/exercises.
  it('no banner on organic visit when sessionSummary is set but fromFinish is absent', async () => {
    // Given: sessionSummary is still in the store (leftover from a previous session)
    useExercisePracticeStore.setState({ sessionSummary: fullSummary });

    // When: overview mounts WITHOUT fromFinish route-state (organic navigation)
    renderWithRouteState(null);

    await waitFor(() => {
      expect(screen.getByTestId('exercise-pre-session-page')).toBeInTheDocument();
    });

    // Then: no banner — the route-state guard prevents stale banner from showing
    expect(screen.queryByTestId('xd-completion-banner')).not.toBeInTheDocument();
  });

  // QA adversarial: perfect session (correct === total → missed === 0)
  // The banner must render "0" for missed and must not crash or show a negative number.
  it('banner shows missed=0 when all exercises were correct (perfect session)', async () => {
    // A perfect session: 3/3 correct, 0 missed
    const perfectSummary = {
      total: 3,
      correct: 3,
      accuracy_pct: 100,
      duration_seconds: 60,
    };
    useExercisePracticeStore.setState({ sessionSummary: perfectSummary });

    renderWithRouteState({ fromFinish: true });

    await waitFor(() => {
      expect(screen.getByTestId('xd-completion-banner')).toBeInTheDocument();
    });

    const banner = screen.getByTestId('xd-completion-banner');
    // Correct count = 3
    expect(banner).toHaveTextContent('3');
    // Missed count = total − correct = 0
    // The banner must show "0" explicitly, not a negative or missing value
    expect(banner).toHaveTextContent('0');
    // Must not show negative numbers
    expect(banner.textContent).not.toMatch(/-\d+/);
  });
});
