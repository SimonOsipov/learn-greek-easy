// src/components/situations/__tests__/SituationExercisePreviewModal.test.tsx
//
// SIT-27-11: component test for the read-only exercise preview modal (Core AC 3).
//
// Asserts the read-only contract:
//  - the correct option is marked (success styling + "Correct" badge)
//  - the EL/EN/RU language tabs switch the rendered prompt/option text
//  - NO graded SM-2 attempt is recorded: exerciseAPI.submitReview is never called
//    and the only callback the modal can fire is onClose.

import { createElement } from 'react';

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import userEvent from '@testing-library/user-event';

import { render, screen, within } from '@/lib/test-utils';
import { SituationExercisePreviewModal } from '@/components/situations/SituationExercisePreviewModal';
import { exerciseAPI } from '@/services/exerciseAPI';
import type { ExerciseQueueItem } from '@/services/exerciseAPI';

// The modal must never start a graded attempt — spy on submitReview to prove it.
vi.mock('@/services/exerciseAPI', () => ({
  exerciseAPI: {
    submitReview: vi.fn(),
    getAllForSituation: vi.fn(),
    getQueue: vi.fn(),
  },
}));

vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
  registerTheme: vi.fn(),
  registerInterfaceLanguage: vi.fn(),
}));

function makeSelectExercise(overrides: Partial<ExerciseQueueItem> = {}): ExerciseQueueItem {
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
    // No audio URL → the WaveformPlayer branch is skipped (keeps jsdom happy).
    description_audio_url: null,
    description_audio_duration: null,
    word_timestamps: null,
    items: [
      {
        item_index: 0,
        payload: {
          prompt: { el: 'Ποια είναι σωστή;', en: 'Which is correct?', ru: 'Что верно?' },
          options: [
            { el: 'Σωστό', en: 'Right answer', ru: 'Верный ответ' },
            { el: 'Λάθος', en: 'Wrong answer', ru: 'Неверный ответ' },
          ],
          correct_answer_index: 0,
        },
      },
    ],
    ...overrides,
  };
}

function renderModal(exercise: ExerciseQueueItem | null, onClose = vi.fn()) {
  render(createElement(SituationExercisePreviewModal, { exercise, onClose }));
  return { onClose };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SituationExercisePreviewModal (read-only)', () => {
  it('is closed (renders no dialog) when exercise is null', () => {
    renderModal(null);
    expect(screen.queryByTestId('situation-exercise-preview')).not.toBeInTheDocument();
  });

  it('renders the prompt and options when open, defaulting to Greek', () => {
    renderModal(makeSelectExercise());

    expect(screen.getByTestId('situation-exercise-preview')).toBeInTheDocument();
    // Default language is EL.
    expect(screen.getByText('Ποια είναι σωστή;')).toBeInTheDocument();
    expect(screen.getByText('Σωστό')).toBeInTheDocument();
    expect(screen.getByText('Λάθος')).toBeInTheDocument();
  });

  it('marks exactly the correct option with the "Correct" badge', () => {
    renderModal(makeSelectExercise());

    const options = screen.getByTestId('situation-preview-options');
    const correctMarks = within(options).getAllByTestId('situation-preview-correct');
    expect(correctMarks).toHaveLength(1);
    // The "Correct" badge sits in the same row as the right answer.
    const correctRow = correctMarks[0].closest('div');
    expect(correctRow).not.toBeNull();
    expect(within(correctRow!).getByText('Σωστό')).toBeInTheDocument();
  });

  it('switches the rendered prompt/options when the language tab changes', async () => {
    const user = userEvent.setup();
    renderModal(makeSelectExercise());

    // Switch EL → EN.
    const tabs = screen.getByTestId('situation-preview-lang-tabs');
    await user.click(within(tabs).getByRole('tab', { name: /en/i }));

    expect(await screen.findByText('Which is correct?')).toBeInTheDocument();
    expect(screen.getByText('Right answer')).toBeInTheDocument();
    expect(screen.queryByText('Ποια είναι σωστή;')).not.toBeInTheDocument();
  });

  it('records no graded attempt — submitReview is never called', async () => {
    const user = userEvent.setup();
    renderModal(makeSelectExercise());

    // Interact with the read-only surface: switch language, "click" the correct option row.
    const tabs = screen.getByTestId('situation-preview-lang-tabs');
    await user.click(within(tabs).getByRole('tab', { name: /ru/i }));
    await user.click(screen.getByText('Верный ответ'));

    expect(exerciseAPI.submitReview as Mock).not.toHaveBeenCalled();
  });
});
