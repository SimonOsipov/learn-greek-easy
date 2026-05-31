/**
 * SituationsPage Tests
 *
 * Covers:
 * - getCompletionStatus three-way classifier (not-started / in-progress / completed)
 *   including the data-anomaly edge: total=0, completed>0 → 'in-progress'
 * - Completion filter hides non-matching items
 * - activeFilterCount 0/1/2
 * - useDebounce delay (300 ms)
 */

import { act } from 'react';

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement } from 'react';

import { QueryClientProvider } from '@tanstack/react-query';

import { SituationsPage } from '@/pages/SituationsPage';
import { render, createTestQueryClient } from '@/lib/test-utils';
import { situationAPI } from '@/services/situationAPI';
import type { LearnerSituationListItem, LearnerSituationListResponse } from '@/types/situation';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/services/situationAPI', () => ({
  situationAPI: {
    getList: vi.fn(),
    getById: vi.fn(),
  },
}));

vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
  registerTheme: vi.fn(),
  registerInterfaceLanguage: vi.fn(),
}));

vi.mock('@/lib/errorReporting', () => ({
  reportAPIError: vi.fn(),
}));

vi.mock('@/lib/deckBackground', () => ({
  getDeckBackgroundStyle: vi.fn(() => ({})),
}));

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

let _idCounter = 0;

function createSituationItem(
  overrides: Partial<LearnerSituationListItem> = {}
): LearnerSituationListItem {
  _idCounter += 1;
  return {
    id: `situation-${_idCounter}`,
    scenario_el: `Σενάριο-${_idCounter}`, // unique Greek text, won't collide with English buttons
    scenario_en: `Scenario ${_idCounter}`,
    scenario_ru: `Сценарий ${_idCounter}`,
    status: 'ready',
    has_audio: false,
    has_dialog: false,
    exercise_total: 0,
    exercise_completed: 0,
    source_image_url: null,
    ...overrides,
  };
}

function makeListResponse(
  items: LearnerSituationListItem[],
  total?: number
): LearnerSituationListResponse {
  return {
    items,
    total: total ?? items.length,
    page: 1,
    page_size: 20,
  };
}

// ---------------------------------------------------------------------------
// Render helper — wraps in QueryClientProvider then the standard render
// ---------------------------------------------------------------------------

function renderPage() {
  const queryClient = createTestQueryClient();
  const wrapped = createElement(
    QueryClientProvider,
    { client: queryClient },
    createElement(SituationsPage)
  );
  return render(wrapped);
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  _idCounter = 0;
});

// ---------------------------------------------------------------------------
// Helper: wait for the grid to appear (page loaded successfully)
// ---------------------------------------------------------------------------

async function waitForGrid() {
  await waitFor(() => {
    expect(screen.getAllByTestId('situation-item').length).toBeGreaterThan(0);
  });
}

// Returns the scenario_el texts rendered inside situation-item cards
function getRenderedItemIds(): string[] {
  return screen.queryAllByTestId('situation-item').map((el) => {
    // The Link wraps a Card; extract the first <p> (scenario_el)
    const p = el.querySelector('p');
    return p?.textContent ?? '';
  });
}

// ===========================================================================
// 1. getCompletionStatus – three-way classifier
//    Tested via completion filter: each filter value should match the item it
//    classifies, and hide the others.
// ===========================================================================

describe('getCompletionStatus classifier (via completion filter)', () => {
  it('classifies exercise_completed=0, exercise_total=0 as not-started', async () => {
    const user = userEvent.setup();

    // Use greek scenario names — they cannot collide with "Not Started" button text
    const notStarted = createSituationItem({ exercise_completed: 0, exercise_total: 0 });
    const inProgress = createSituationItem({ exercise_completed: 2, exercise_total: 5 });
    const completed = createSituationItem({ exercise_completed: 5, exercise_total: 5 });

    (situationAPI.getList as Mock).mockResolvedValue(
      makeListResponse([notStarted, inProgress, completed])
    );

    renderPage();
    await waitForGrid();

    expect(getRenderedItemIds()).toHaveLength(3);

    // Click "Not Started" filter button
    await user.click(screen.getByRole('button', { name: /not.?started/i }));

    await waitFor(() => {
      const ids = getRenderedItemIds();
      expect(ids).toHaveLength(1);
      expect(ids[0]).toBe(notStarted.scenario_el);
    });
  });

  it('classifies exercise_completed=0, exercise_total>0 as not-started', async () => {
    const user = userEvent.setup();

    const notStarted = createSituationItem({ exercise_completed: 0, exercise_total: 10 });
    const inProgress = createSituationItem({ exercise_completed: 1, exercise_total: 10 });

    (situationAPI.getList as Mock).mockResolvedValue(makeListResponse([notStarted, inProgress]));

    renderPage();
    await waitForGrid();

    await user.click(screen.getByRole('button', { name: /not.?started/i }));

    await waitFor(() => {
      const ids = getRenderedItemIds();
      expect(ids).toHaveLength(1);
      expect(ids[0]).toBe(notStarted.scenario_el);
    });
  });

  it('classifies exercise_completed>0 and completed<total as in-progress', async () => {
    const user = userEvent.setup();

    const inProgress = createSituationItem({ exercise_completed: 3, exercise_total: 5 });
    const notStarted = createSituationItem({ exercise_completed: 0, exercise_total: 5 });

    (situationAPI.getList as Mock).mockResolvedValue(makeListResponse([inProgress, notStarted]));

    renderPage();
    await waitForGrid();

    await user.click(screen.getByRole('button', { name: /in.?progress/i }));

    await waitFor(() => {
      const ids = getRenderedItemIds();
      expect(ids).toHaveLength(1);
      expect(ids[0]).toBe(inProgress.scenario_el);
    });
  });

  it('classifies exercise_completed===exercise_total>0 as completed', async () => {
    const user = userEvent.setup();

    const completed = createSituationItem({ exercise_completed: 7, exercise_total: 7 });
    const inProgress = createSituationItem({ exercise_completed: 6, exercise_total: 7 });

    (situationAPI.getList as Mock).mockResolvedValue(makeListResponse([completed, inProgress]));

    renderPage();
    await waitForGrid();

    await user.click(screen.getByRole('button', { name: /^completed$/i }));

    await waitFor(() => {
      const ids = getRenderedItemIds();
      expect(ids).toHaveLength(1);
      expect(ids[0]).toBe(completed.scenario_el);
    });
  });

  /**
   * Data anomaly: exercise_total=0, exercise_completed>0.
   *
   * This state should not occur in production but can arrive from stale data.
   * The classifier returns 'in-progress' because:
   *   - exercise_completed !== 0  → first guard does not trigger
   *   - exercise_total is 0       → second guard (total > 0 && ...) does not trigger
   *   - falls through to 'in-progress'
   *
   * This pins the current behavior. If the backend guarantees this state never
   * exists, the anomaly case is harmless; if it does occur, the item will
   * appear under the In Progress filter rather than Not Started.
   */
  it('data anomaly: total=0, completed>0 is classified as in-progress (not not-started)', async () => {
    const user = userEvent.setup();

    const anomalous = createSituationItem({ exercise_completed: 1, exercise_total: 0 });

    (situationAPI.getList as Mock).mockResolvedValue(makeListResponse([anomalous]));

    renderPage();
    await waitForGrid();

    // Under 'not-started' filter the anomalous item should NOT appear
    await user.click(screen.getByRole('button', { name: /not.?started/i }));

    await waitFor(() => {
      expect(screen.queryByTestId('situation-item')).not.toBeInTheDocument();
    });

    // Toggle off not-started (back to 'all'), then check in-progress
    await user.click(screen.getByRole('button', { name: /not.?started/i }));

    await waitFor(() => {
      expect(getRenderedItemIds()).toHaveLength(1);
    });

    await user.click(screen.getByRole('button', { name: /in.?progress/i }));

    await waitFor(() => {
      const ids = getRenderedItemIds();
      expect(ids).toHaveLength(1);
      expect(ids[0]).toBe(anomalous.scenario_el);
    });
  });
});

// ===========================================================================
// 2. Completion filter hides non-matching items
// ===========================================================================

describe('Completion filter', () => {
  it('all filter (default) shows every item', async () => {
    const items = [
      createSituationItem({ exercise_completed: 0, exercise_total: 0 }),
      createSituationItem({ exercise_completed: 1, exercise_total: 5 }),
      createSituationItem({ exercise_completed: 5, exercise_total: 5 }),
    ];

    (situationAPI.getList as Mock).mockResolvedValue(makeListResponse(items));

    renderPage();
    await waitForGrid();

    // Default filter is 'all' — all three items must appear
    expect(screen.getAllByTestId('situation-item')).toHaveLength(3);
  });

  it('toggling the same completion filter twice resets to all', async () => {
    const user = userEvent.setup();

    const items = [
      createSituationItem({ exercise_completed: 0, exercise_total: 0 }),
      createSituationItem({ exercise_completed: 1, exercise_total: 3 }),
    ];

    (situationAPI.getList as Mock).mockResolvedValue(makeListResponse(items));

    renderPage();
    await waitForGrid();

    const notStartedBtn = screen.getByRole('button', { name: /not.?started/i });

    // First click filters to not-started
    await user.click(notStartedBtn);
    await waitFor(() => {
      expect(screen.getAllByTestId('situation-item')).toHaveLength(1);
    });

    // Second click (same button) toggles back to 'all'
    await user.click(notStartedBtn);
    await waitFor(() => {
      expect(screen.getAllByTestId('situation-item')).toHaveLength(2);
    });
  });

  it('completed filter hides not-started and in-progress items', async () => {
    const user = userEvent.setup();

    const zero = createSituationItem({ exercise_completed: 0, exercise_total: 5 });
    const half = createSituationItem({ exercise_completed: 2, exercise_total: 5 });
    const full = createSituationItem({ exercise_completed: 5, exercise_total: 5 });

    (situationAPI.getList as Mock).mockResolvedValue(makeListResponse([zero, half, full]));

    renderPage();
    await waitForGrid();

    await user.click(screen.getByRole('button', { name: /^completed$/i }));

    await waitFor(() => {
      const ids = getRenderedItemIds();
      expect(ids).toHaveLength(1);
      expect(ids[0]).toBe(full.scenario_el);
    });
  });

  it('in-progress filter hides not-started and completed items', async () => {
    const user = userEvent.setup();

    const zero = createSituationItem({ exercise_completed: 0, exercise_total: 5 });
    const partial = createSituationItem({ exercise_completed: 3, exercise_total: 5 });
    const full = createSituationItem({ exercise_completed: 5, exercise_total: 5 });

    (situationAPI.getList as Mock).mockResolvedValue(makeListResponse([zero, partial, full]));

    renderPage();
    await waitForGrid();

    await user.click(screen.getByRole('button', { name: /in.?progress/i }));

    await waitFor(() => {
      const ids = getRenderedItemIds();
      expect(ids).toHaveLength(1);
      expect(ids[0]).toBe(partial.scenario_el);
    });
  });
});

// ===========================================================================
// 3. activeFilterCount 0 / 1 / 2
// ===========================================================================

describe('activeFilterCount badge', () => {
  beforeEach(() => {
    const items = [
      createSituationItem({ has_audio: true, exercise_completed: 0, exercise_total: 0 }),
      createSituationItem({ has_audio: false, exercise_completed: 1, exercise_total: 5 }),
    ];
    (situationAPI.getList as Mock).mockResolvedValue(makeListResponse(items));
  });

  it('shows no "Clear all" button when activeFilterCount is 0', async () => {
    renderPage();
    await waitForGrid();

    expect(screen.queryByRole('button', { name: /clear all/i })).not.toBeInTheDocument();
  });

  it('shows "Clear all (1)" when one filter is active', async () => {
    const user = userEvent.setup();

    renderPage();
    await waitForGrid();

    await user.click(screen.getByTestId('situations-audio-filter'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /clear all.*\(1\)/i })).toBeInTheDocument();
    });
  });

  it('shows "Clear all (2)" when both filters are active', async () => {
    const user = userEvent.setup();

    renderPage();
    await waitForGrid();

    await user.click(screen.getByTestId('situations-audio-filter'));
    await user.click(screen.getByRole('button', { name: /not.?started/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /clear all.*\(2\)/i })).toBeInTheDocument();
    });
  });

  it('Clear All resets both filters so count returns to 0', async () => {
    const user = userEvent.setup();

    renderPage();
    await waitForGrid();

    await user.click(screen.getByTestId('situations-audio-filter'));
    await user.click(screen.getByRole('button', { name: /not.?started/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /clear all.*\(2\)/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /clear all.*\(2\)/i }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /clear all/i })).not.toBeInTheDocument();
    });
  });
});

// ===========================================================================
// 4. useDebounce delay (300 ms)
// ===========================================================================

describe('useDebounce search delay', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not trigger a new query before 300 ms elapses', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    const items = [createSituationItem()];
    (situationAPI.getList as Mock).mockResolvedValue(makeListResponse(items));

    renderPage();

    // Wait for initial load
    await waitFor(() => {
      expect(situationAPI.getList).toHaveBeenCalledTimes(1);
    });

    const searchInput = screen.getByTestId('situations-search');
    await user.type(searchInput, 'α');

    // Advance only 200 ms — still within debounce window
    act(() => {
      vi.advanceTimersByTime(200);
    });

    // Query count should still be 1 (debounce not fired yet)
    expect(situationAPI.getList).toHaveBeenCalledTimes(1);
  });

  it('triggers a new query after 300 ms elapses', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    const items = [createSituationItem()];
    (situationAPI.getList as Mock).mockResolvedValue(makeListResponse(items));

    renderPage();

    await waitFor(() => {
      expect(situationAPI.getList).toHaveBeenCalledTimes(1);
    });

    const searchInput = screen.getByTestId('situations-search');
    await user.type(searchInput, 'α');

    // Advance past the 300 ms debounce boundary
    act(() => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(situationAPI.getList).toHaveBeenCalledTimes(2);
    });

    // Second call must include the search term
    expect(situationAPI.getList).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'α' }));
  });
});
