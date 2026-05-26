/**
 * AdminExercisesSection integration tests (TBR2-25-09)
 *
 * Covers the store ↔ URL ↔ fetch wiring:
 * 1. On mount — both getExercises and getExerciseStats are called once
 * 2. Filter change — setStatus triggers refetch of BOTH endpoints
 * 3. Page change — triggers ONLY getExercises refetch (stats page-independent)
 * 4. URL hydration — render with search params; store reflects values + correct fetch args
 * 5. Empty list — AdminExercisesEmptyState (data-testid="admin-exercises-empty") renders
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { adminAPI } from '@/services/adminAPI';
import { useAdminExercisesStore } from '@/stores/adminExercisesStore';
import type { AdminExerciseListItem } from '@/types/situation';

import { AdminExercisesSection } from '../AdminExercisesSection';

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('@/services/adminAPI', () => ({
  adminAPI: {
    getExercises: vi.fn(),
    getExerciseStats: vi.fn(),
  },
}));

// Mock heavy sub-components so renders stay fast
vi.mock('../AdminExerciseRow', () => ({
  AdminExerciseRow: () => <div data-testid="admin-exercise-row" />,
}));
vi.mock('../AdminExerciseBody', () => ({
  AdminExerciseBody: () => <div data-testid="admin-exercise-body" />,
}));
vi.mock('@/components/culture/WaveformPlayer', () => ({
  WaveformPlayer: () => <div data-testid="waveform-player" />,
}));
vi.mock('@/lib/analytics/track', () => ({
  track: vi.fn(),
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeExercise(id: string): AdminExerciseListItem {
  return {
    id,
    exercise_type: 'select_correct_answer',
    status: 'approved',
    source_type: 'description',
    modality: 'listening',
    audio_level: 'B1',
    situation_id: 'sit-1',
    situation_title_el: 'Τίτλος',
    situation_title_en: 'Title',
    audio_url: null,
    reading_text: null,
    anchor_picture_url: null,
    anchor_description_text: null,
    item_count: 1,
    items: [],
    question_el: null,
    question_en: null,
    correct_idx: null,
    correct_order: null,
    answer_el: null,
  };
}

const DEFAULT_STATS = {
  total: 10,
  approved: 8,
  pending: 1,
  draft: 1,
  with_audio: 5,
  missing_audio: 5,
  distinct_types: 3,
};

function mockApiSuccess(items: AdminExerciseListItem[] = [], total = items.length) {
  vi.mocked(adminAPI.getExercises).mockResolvedValue({
    items,
    total,
    page: 1,
    page_size: 20,
  });
  vi.mocked(adminAPI.getExerciseStats).mockResolvedValue(DEFAULT_STATS);
}

function renderSection(initialEntries = ['/']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AdminExercisesSection />
    </MemoryRouter>
  );
}

// ── Setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  // Reset store to clean defaults so tests don't leak state into each other
  useAdminExercisesStore.setState({
    source: 'all',
    type: 'all',
    level: 'all',
    status: 'all',
    modality: 'listening',
    q: '',
    qDebounced: '',
    page: 1,
    mode: null,
    openEntryId: null,
  });
});

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('AdminExercisesSection — on mount', () => {
  it('calls getExercises and getExerciseStats once on mount', async () => {
    mockApiSuccess();

    renderSection();

    await waitFor(() => {
      expect(vi.mocked(adminAPI.getExercises)).toHaveBeenCalledTimes(1);
      expect(vi.mocked(adminAPI.getExerciseStats)).toHaveBeenCalledTimes(1);
    });
  });

  it('calls getExercises with default store state (modality=listening, page=1)', async () => {
    mockApiSuccess();

    renderSection();

    await waitFor(() => {
      expect(vi.mocked(adminAPI.getExercises)).toHaveBeenCalledWith(
        expect.objectContaining({ modality: 'listening', page: 1 })
      );
    });
  });
});

describe('AdminExercisesSection — filter change', () => {
  it('refetches both getExercises and getExerciseStats when status changes', async () => {
    mockApiSuccess();

    renderSection();

    await waitFor(() => {
      expect(vi.mocked(adminAPI.getExercises)).toHaveBeenCalledTimes(1);
    });

    // Reset call counts after initial fetch
    vi.clearAllMocks();
    mockApiSuccess();

    // Change a filter
    act(() => {
      useAdminExercisesStore.getState().setStatus('approved');
    });

    await waitFor(() => {
      expect(vi.mocked(adminAPI.getExercises)).toHaveBeenCalledTimes(1);
      expect(vi.mocked(adminAPI.getExerciseStats)).toHaveBeenCalledTimes(1);
    });

    expect(vi.mocked(adminAPI.getExercises)).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'approved' })
    );
    expect(vi.mocked(adminAPI.getExerciseStats)).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'approved' })
    );
  });
});

describe('AdminExercisesSection — page change', () => {
  it('refetches getExercises but NOT getExerciseStats when page changes', async () => {
    mockApiSuccess([makeExercise('ex-1')], 50);

    renderSection();

    await waitFor(() => {
      expect(vi.mocked(adminAPI.getExercises)).toHaveBeenCalledTimes(1);
      expect(vi.mocked(adminAPI.getExerciseStats)).toHaveBeenCalledTimes(1);
    });

    const statsCallCountAfterMount = vi.mocked(adminAPI.getExerciseStats).mock.calls.length;

    vi.clearAllMocks();
    mockApiSuccess([makeExercise('ex-1')], 50);

    act(() => {
      useAdminExercisesStore.getState().setPage(2);
    });

    await waitFor(() => {
      expect(vi.mocked(adminAPI.getExercises)).toHaveBeenCalledTimes(1);
    });

    // getExerciseStats should NOT have been called again after page change
    expect(vi.mocked(adminAPI.getExerciseStats)).toHaveBeenCalledTimes(0);
    // Sanity check: initial call count was 1 (mount only)
    expect(statsCallCountAfterMount).toBe(1);
  });
});

describe('AdminExercisesSection — URL hydration', () => {
  it('hydrates store from URL params and calls getExercises with those values', async () => {
    mockApiSuccess();

    renderSection(['/?modality=reading&status=approved&page=2']);

    await waitFor(() => {
      expect(vi.mocked(adminAPI.getExercises)).toHaveBeenCalledWith(
        expect.objectContaining({
          modality: 'reading',
          status: 'approved',
          page: 2,
        })
      );
    });
  });
});

describe('AdminExercisesSection — empty list', () => {
  it('renders AdminExercisesEmptyState when getExercises returns empty list', async () => {
    mockApiSuccess([], 0);

    renderSection();

    await waitFor(() => {
      expect(screen.getByTestId('admin-exercises-empty')).toBeTruthy();
    });
  });
});
