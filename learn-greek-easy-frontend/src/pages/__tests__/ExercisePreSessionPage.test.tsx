/**
 * ExercisePreSessionPage Smoke Tests — PRACT2-12-03
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
 */

import { createElement } from 'react';

import { QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';

import { createTestQueryClient, renderWithProviders } from '@/lib/test-utils';

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
