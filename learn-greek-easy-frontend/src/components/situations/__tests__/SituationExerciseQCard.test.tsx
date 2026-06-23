// src/components/situations/__tests__/SituationExerciseQCard.test.tsx
//
// SIT-27-11: component test for the exercise-grid q-card mastery pips (Core AC 2).
//
// The 0–4 status → pip-count mapping is exhaustively covered as a pure unit test
// (exerciseGridHelpers.test.ts statusToPips). This test only proves that those
// derived pip props (data-filled count + data-tone) actually reach the rendered
// DOM, for a couple of representative statuses — not the full mapping again.

import { createElement } from 'react';

import { describe, it, expect, vi } from 'vitest';

import { render, screen } from '@/lib/test-utils';
import { SituationExerciseQCard } from '@/components/situations/SituationExerciseQCard';
import type { ExerciseQueueItem } from '@/services/exerciseAPI';

vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
  registerTheme: vi.fn(),
  registerInterfaceLanguage: vi.fn(),
}));

function makeExercise(overrides: Partial<ExerciseQueueItem> = {}): ExerciseQueueItem {
  return {
    exercise_id: '11111111-2222-3333-4444-555555555555',
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
    items: [
      {
        item_index: 0,
        payload: {
          prompt: { el: 'Ερώτηση', en: 'Question', ru: 'Вопрос' },
          options: [{}, {}, {}, {}],
          correct_answer_index: 0,
        },
      },
    ],
    ...overrides,
  };
}

/** Read the filled-pip count from the rendered .cx-pips row. */
function filledPipCount(): number {
  const pips = Array.from(document.querySelectorAll('.cx-pip'));
  return pips.filter((p) => p.getAttribute('data-filled') === 'true').length;
}

function pipTone(): string | null {
  return document.querySelector('.cx-pip')?.getAttribute('data-tone') ?? null;
}

function renderCard(exercise: ExerciseQueueItem) {
  return render(
    createElement(SituationExerciseQCard, { exercise, language: 'en', onPreview: vi.fn() })
  );
}

describe('SituationExerciseQCard mastery pips', () => {
  it('renders 4 pip slots in every state', () => {
    renderCard(makeExercise({ status: 'new' }));
    expect(document.querySelectorAll('.cx-pip')).toHaveLength(4);
  });

  it('mastered → 4 filled pips, mastered tone', () => {
    renderCard(makeExercise({ status: 'mastered' }));
    expect(filledPipCount()).toBe(4);
    expect(pipTone()).toBe('mastered');
  });

  it('learning → 1 filled pip, learning tone', () => {
    renderCard(makeExercise({ status: 'learning' }));
    expect(filledPipCount()).toBe(1);
    expect(pipTone()).toBe('learning');
  });

  it('new → 0 filled pips', () => {
    renderCard(makeExercise({ status: 'new' }));
    expect(filledPipCount()).toBe(0);
  });

  it('renders the prompt in the requested language', () => {
    renderCard(makeExercise({ status: 'review' }));
    expect(screen.getByText('Question')).toBeInTheDocument();
  });
});
