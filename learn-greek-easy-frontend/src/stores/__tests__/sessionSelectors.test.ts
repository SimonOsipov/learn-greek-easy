// src/stores/__tests__/sessionSelectors.test.ts
// RED specs for PRACT2-12-05 pure session selectors.
// These tests fail against the stub placeholders in sessionSelectors.ts
// (selectLiveStats returns {correct:0, missed:0, accuracyPct:0} and
//  selectStepperStatus returns []) and must turn GREEN once the real
//  implementation is written.

import { describe, expect, it } from 'vitest';

import type { ExerciseQueueItem } from '@/services/exerciseAPI';

import { selectLiveStats, selectStepperStatus } from '../sessionSelectors';
import type { SessionSelectorState } from '../sessionSelectors';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQueueItem(id: string): ExerciseQueueItem {
  return {
    exercise_id: id,
    source_type: 'description' as const,
    exercise_type: 'select_correct_answer' as const,
    modality: 'listening' as const,
    audio_level: null,
    status: 'new' as const,
    is_new: true,
    is_early_practice: false,
    due_date: null,
    easiness_factor: null,
    interval: null,
    situation_id: null,
    scenario_el: null,
    scenario_en: null,
    scenario_ru: null,
    description_text_el: null,
    description_audio_url: null,
    description_audio_duration: null,
    word_timestamps: null,
    items: [],
  };
}

// ---------------------------------------------------------------------------
// selectLiveStats
// ---------------------------------------------------------------------------

describe('selectLiveStats', () => {
  it('derives correct/missed/accuracy from a mixed answers map', () => {
    // 2 answers: one correct, one incorrect
    const state: SessionSelectorState = {
      queue: [makeQueueItem('a'), makeQueueItem('b')],
      currentIndex: 2,
      answers: {
        a: { selectedIndex: 0, correct: true },
        b: { selectedIndex: 1, correct: false },
      },
    };

    const result = selectLiveStats(state);

    expect(result.correct).toBe(1);
    expect(result.missed).toBe(1);
    expect(result.accuracyPct).toBe(50);
  });

  it('returns zero accuracy when no answers have been recorded', () => {
    const state: SessionSelectorState = {
      queue: [makeQueueItem('a')],
      currentIndex: 0,
      answers: {},
    };

    const result = selectLiveStats(state);

    expect(result.correct).toBe(0);
    expect(result.missed).toBe(0);
    expect(result.accuracyPct).toBe(0);
  });

  it('returns 100% accuracy when all answers are correct', () => {
    const state: SessionSelectorState = {
      queue: [makeQueueItem('a'), makeQueueItem('b')],
      currentIndex: 2,
      answers: {
        a: { selectedIndex: 0, correct: true },
        b: { selectedIndex: 0, correct: true },
      },
    };

    const result = selectLiveStats(state);

    expect(result.correct).toBe(2);
    expect(result.missed).toBe(0);
    expect(result.accuracyPct).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// selectStepperStatus
// ---------------------------------------------------------------------------

describe('selectStepperStatus', () => {
  it('marks answered-correct / current / pending for a 3-item queue at index 1', () => {
    // Queue: items a, b, c. currentIndex=1. Item a answered correct.
    const state: SessionSelectorState = {
      queue: [makeQueueItem('a'), makeQueueItem('b'), makeQueueItem('c')],
      currentIndex: 1,
      answers: {
        a: { selectedIndex: 0, correct: true },
      },
    };

    const result = selectStepperStatus(state);

    expect(result).toHaveLength(3);
    expect(result[0]).toBe('correct'); // answered, correct
    expect(result[1]).toBe('current'); // at currentIndex, not yet answered
    expect(result[2]).toBe('pending'); // future item, not answered
  });

  it('marks answered-incorrect correctly', () => {
    const state: SessionSelectorState = {
      queue: [makeQueueItem('a'), makeQueueItem('b')],
      currentIndex: 1,
      answers: {
        a: { selectedIndex: 1, correct: false },
      },
    };

    const result = selectStepperStatus(state);

    expect(result[0]).toBe('incorrect');
    expect(result[1]).toBe('current');
  });

  it('returns all-pending when nothing is answered and index is 0', () => {
    const state: SessionSelectorState = {
      queue: [makeQueueItem('a'), makeQueueItem('b'), makeQueueItem('c')],
      currentIndex: 0,
      answers: {},
    };

    const result = selectStepperStatus(state);

    expect(result[0]).toBe('current');
    expect(result[1]).toBe('pending');
    expect(result[2]).toBe('pending');
  });

  it('returns an empty array for an empty queue', () => {
    const state: SessionSelectorState = {
      queue: [],
      currentIndex: 0,
      answers: {},
    };

    const result = selectStepperStatus(state);

    expect(result).toHaveLength(0);
  });
});
