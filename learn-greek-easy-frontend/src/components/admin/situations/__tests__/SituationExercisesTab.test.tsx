// src/components/admin/situations/__tests__/SituationExercisesTab.test.tsx
//
// SIT-07d: SituationExercisesTab unit tests.
// Covers: back-compat (uncontrolled), controlled mode (hideSourceFilter),
// onDataLoaded firing rules (once per situationId, re-fires on id change,
// does NOT re-fire on re-render).

import React from 'react';

import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SituationExercisesResponse } from '@/types/situation';

import { SituationExercisesTab } from '../SituationExercisesTab';

// ── i18n mock ─────────────────────────────────────────────────────────────────

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'situations.detail.exercises.error': 'Failed to load exercises',
        'situations.detail.exercises.empty.noExercises': 'No exercises yet',
        'situations.detail.exercises.empty.noExercisesInGroup': 'No exercises in this group',
        'situations.detail.exercises.sourceType.dialog': 'Dialog Exercises',
        'situations.detail.exercises.sourceType.description': 'Description Exercises',
        'situations.detail.exercises.sourceType.picture': 'Picture Exercises',
        'situations.detail.exercises.type.fill_gaps': 'Fill Gaps',
        'situations.detail.exercises.type.select_correct_answer': 'Select Correct Answer',
        'situations.detail.exercises.status.draft': 'Draft',
        'situations.detail.exercises.status.approved': 'Approved',
      };
      return map[key] ?? key;
    },
    i18n: { language: 'en' },
  }),
}));

// ── adminAPI mock ──────────────────────────────────────────────────────────────

const mockGetSituationExercises = vi.fn();

vi.mock('@/services/adminAPI', () => ({
  adminAPI: {
    getSituationExercises: (...args: unknown[]) => mockGetSituationExercises(...args),
  },
}));

// ── ExerciseItemPayload mock ───────────────────────────────────────────────────

vi.mock('../../exercises/ExerciseItemPayload', () => ({
  ExerciseItemPayload: ({ payload }: { payload: unknown }) => (
    <div data-testid="exercise-item-payload">{JSON.stringify(payload)}</div>
  ),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeExercise(id: string) {
  return {
    id,
    exercise_type: 'fill_gaps',
    status: 'draft',
    modality: 'reading',
    audio_level: null,
    audio_url: null,
    reading_text: null,
    items: [],
  };
}

function makeFullResponse(): SituationExercisesResponse {
  return {
    total_count: 4,
    groups: [
      {
        source_type: 'dialog',
        exercise_count: 2,
        exercises: [makeExercise('ex-d1'), makeExercise('ex-d2')],
      },
      {
        source_type: 'description',
        exercise_count: 1,
        exercises: [makeExercise('ex-desc1')],
      },
      {
        source_type: 'picture',
        exercise_count: 1,
        exercises: [makeExercise('ex-pic1')],
      },
    ],
  };
}

function makeEmptyResponse(): SituationExercisesResponse {
  return { total_count: 0, groups: [] };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// 1. Back-compat: uncontrolled renders multi-group accordion

describe('SituationExercisesTab — back-compat (uncontrolled mode)', () => {
  it('renders all source-group accordions when only situationId is provided', async () => {
    mockGetSituationExercises.mockResolvedValue(makeFullResponse());
    render(<SituationExercisesTab situationId="sit-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('situation-exercises-group-dialog')).toBeInTheDocument();
    });
    expect(screen.getByTestId('situation-exercises-group-description')).toBeInTheDocument();
    expect(screen.getByTestId('situation-exercises-group-picture')).toBeInTheDocument();
  });

  it('renders legacy empty state when total_count is 0 (uncontrolled)', async () => {
    mockGetSituationExercises.mockResolvedValue(makeEmptyResponse());
    render(<SituationExercisesTab situationId="sit-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('situation-exercises-empty')).toBeInTheDocument();
    });
    expect(screen.getByText('No exercises yet')).toBeInTheDocument();
  });
});

// 3. Controlled mode renders only active group

describe('SituationExercisesTab — controlled mode (hideSourceFilter)', () => {
  it('renders only description exercises when value="description"', async () => {
    mockGetSituationExercises.mockResolvedValue(makeFullResponse());
    render(<SituationExercisesTab situationId="sit-1" hideSourceFilter value="description" />);

    await waitFor(() => {
      expect(screen.getByTestId('situation-exercises-item-ex-desc1')).toBeInTheDocument();
    });
    // Dialog and picture group headers should NOT be present
    expect(screen.queryByTestId('situation-exercises-group-dialog')).toBeNull();
    expect(screen.queryByTestId('situation-exercises-group-picture')).toBeNull();
    // Dialog exercise items should NOT be present
    expect(screen.queryByTestId('situation-exercises-item-ex-d1')).toBeNull();
  });

  it('renders null (not legacy empty) when controlled active group has 0 exercises', async () => {
    const response: SituationExercisesResponse = {
      total_count: 2,
      groups: [
        {
          source_type: 'dialog',
          exercise_count: 2,
          exercises: [makeExercise('ex-d1'), makeExercise('ex-d2')],
        },
        { source_type: 'picture', exercise_count: 0, exercises: [] },
      ],
    };
    mockGetSituationExercises.mockResolvedValue(response);
    render(<SituationExercisesTab situationId="sit-1" hideSourceFilter value="picture" />);

    await waitFor(() => {
      // Loading disappears
      expect(screen.queryByTestId('situation-exercises-loading')).toBeNull();
    });
    // No legacy empty-state in controlled mode
    expect(screen.queryByTestId('situation-exercises-empty')).toBeNull();
    // No exercise items
    expect(screen.queryByTestId('situation-exercises-item-ex-d1')).toBeNull();
  });
});

// 5. onDataLoaded fires exactly once per fetch

describe('SituationExercisesTab — onDataLoaded callback', () => {
  it('fires onDataLoaded once after data is fetched', async () => {
    const response = makeFullResponse();
    mockGetSituationExercises.mockResolvedValue(response);
    const spy = vi.fn();

    render(<SituationExercisesTab situationId="sit-1" onDataLoaded={spy} />);

    await waitFor(() => {
      expect(spy).toHaveBeenCalledTimes(1);
    });
    expect(spy).toHaveBeenCalledWith(response);
  });

  it('does NOT re-fire onDataLoaded on re-render with same situationId', async () => {
    const response = makeFullResponse();
    mockGetSituationExercises.mockResolvedValue(response);
    const spy = vi.fn();

    const { rerender } = render(<SituationExercisesTab situationId="sit-1" onDataLoaded={spy} />);

    await waitFor(() => {
      expect(spy).toHaveBeenCalledTimes(1);
    });

    // Re-render with same situationId — callback must NOT fire again
    rerender(<SituationExercisesTab situationId="sit-1" onDataLoaded={spy} />);

    // Give time for any erroneous second call
    await new Promise((r) => setTimeout(r, 50));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('re-fires onDataLoaded when situationId changes', async () => {
    const response1 = makeFullResponse();
    const response2: SituationExercisesResponse = {
      total_count: 1,
      groups: [{ source_type: 'picture', exercise_count: 1, exercises: [makeExercise('ex-p1')] }],
    };

    mockGetSituationExercises.mockResolvedValueOnce(response1).mockResolvedValueOnce(response2);
    const spy = vi.fn();

    const { rerender } = render(<SituationExercisesTab situationId="sit-1" onDataLoaded={spy} />);

    await waitFor(() => {
      expect(spy).toHaveBeenCalledTimes(1);
    });

    // Change situationId — callback should fire again
    rerender(<SituationExercisesTab situationId="sit-2" onDataLoaded={spy} />);

    await waitFor(() => {
      expect(spy).toHaveBeenCalledTimes(2);
    });
    expect(spy).toHaveBeenNthCalledWith(2, response2);
  });
});
