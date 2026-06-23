// src/components/situations/__tests__/exerciseGridHelpers.test.ts
//
// SIT-27-07 unit tests for the pure exercise-grid helpers — status → mastery
// pips, status-filter matching + counts, topic-filter matching, and prompt /
// option extraction. All pure functions, no mocks.

import { describe, it, expect } from 'vitest';

import type { CardStatus, ExerciseQueueItem } from '@/services/exerciseAPI';

import {
  calcStatusCounts,
  exerciseOptionCount,
  exercisePrompt,
  matchesStatusFilter,
  matchesTopicFilter,
  statusToPips,
} from '../exerciseGridHelpers';

function makeExercise(overrides: Partial<ExerciseQueueItem> = {}): ExerciseQueueItem {
  return {
    exercise_id: 'ex-1',
    source_type: 'description',
    exercise_type: 'select_correct_answer',
    modality: 'reading',
    audio_level: 'B1',
    topic: 'Reading',
    status: 'new',
    is_new: true,
    is_early_practice: false,
    due_date: null,
    easiness_factor: null,
    interval: null,
    situation_id: 'sit-1',
    scenario_el: null,
    scenario_en: null,
    scenario_ru: null,
    description_text_el: null,
    description_audio_url: null,
    description_audio_duration: null,
    word_timestamps: null,
    items: [],
    ...overrides,
  };
}

describe('statusToPips', () => {
  it('maps each status to the documented pip count + tone', () => {
    expect(statusToPips('new')).toEqual({ filled: 0, tone: 'learning' });
    expect(statusToPips('learning')).toEqual({ filled: 1, tone: 'learning' });
    expect(statusToPips('review')).toEqual({ filled: 2, tone: 'review' });
    expect(statusToPips('mastered')).toEqual({ filled: 4, tone: 'mastered' });
  });
});

describe('matchesStatusFilter', () => {
  const cases: [CardStatus, Parameters<typeof matchesStatusFilter>[1], boolean][] = [
    ['mastered', 'all', true],
    ['mastered', 'mastered', true],
    ['new', 'mastered', false],
    ['learning', 'review', true],
    ['review', 'review', true],
    ['new', 'review', false],
    ['new', 'new', true],
  ];
  it.each(cases)('status %s under filter %s → %s', (status, filter, expected) => {
    expect(matchesStatusFilter(status, filter)).toBe(expected);
  });
});

describe('calcStatusCounts', () => {
  it('tallies all / mastered / review (learning+review) / new', () => {
    const exercises = [
      makeExercise({ status: 'new' }),
      makeExercise({ status: 'learning' }),
      makeExercise({ status: 'review' }),
      makeExercise({ status: 'mastered' }),
      makeExercise({ status: 'mastered' }),
    ];
    expect(calcStatusCounts(exercises)).toEqual({ all: 5, mastered: 2, review: 2, new: 1 });
  });
});

describe('matchesTopicFilter', () => {
  it('matches all topics under "all" and the exact topic otherwise', () => {
    expect(matchesTopicFilter('Reading', 'all')).toBe(true);
    expect(matchesTopicFilter('Reading', 'Reading')).toBe(true);
    expect(matchesTopicFilter('Listening', 'Reading')).toBe(false);
    expect(matchesTopicFilter(null, 'Reading')).toBe(false);
    expect(matchesTopicFilter(null, 'all')).toBe(true);
  });
});

describe('exercisePrompt', () => {
  it('extracts the multilingual prompt in the requested language with EN/EL fallback', () => {
    const ex = makeExercise({
      items: [
        {
          item_index: 0,
          payload: {
            prompt: { el: 'Γεια', en: 'Hello', ru: 'Привет' },
            options: [],
            correct_answer_index: 0,
          },
        },
      ],
    });
    expect(exercisePrompt(ex, 'ru')).toBe('Привет');
    expect(exercisePrompt(ex, 'el')).toBe('Γεια');
  });

  it('falls back to prompt_description for picture-match payloads', () => {
    const ex = makeExercise({
      exercise_type: 'select_picture_from_description',
      items: [
        {
          item_index: 0,
          payload: { prompt_description: 'A coffee shop', options: [], correct_index: 0 },
        },
      ],
    });
    expect(exercisePrompt(ex, 'en')).toBe('A coffee shop');
  });

  it('returns empty string when there is no payload', () => {
    expect(exercisePrompt(makeExercise({ items: [] }), 'en')).toBe('');
  });
});

describe('exerciseOptionCount', () => {
  it('counts payload options, 0 when absent', () => {
    const withOptions = makeExercise({
      items: [{ item_index: 0, payload: { options: [{}, {}, {}, {}] } }],
    });
    expect(exerciseOptionCount(withOptions)).toBe(4);
    expect(exerciseOptionCount(makeExercise({ items: [] }))).toBe(0);
  });
});
