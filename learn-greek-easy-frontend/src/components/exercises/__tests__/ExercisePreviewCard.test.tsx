// src/components/exercises/__tests__/ExercisePreviewCard.test.tsx

import { describe, expect, it } from 'vitest';

import { renderWithProviders, screen } from '@/lib/test-utils';
import type { CardStatus, ExerciseQueueItem } from '@/services/exerciseAPI';

import { ExercisePreviewCard } from '../ExercisePreviewCard';

// ============================================
// Helpers
// ============================================

function makeExercise(overrides: Partial<ExerciseQueueItem> = {}): ExerciseQueueItem {
  return {
    exercise_id: 'test-exercise-id',
    source_type: 'description',
    exercise_type: 'select_correct_answer',
    modality: null,
    audio_level: null,
    status: 'new',
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
    items: [
      {
        item_index: 0,
        payload: {
          prompt: { el: 'Ερώτηση', en: 'Question prompt', ru: 'Вопрос' },
          options: [
            { el: 'Επιλογή 1', en: 'Option 1', ru: 'Вариант 1' },
            { el: 'Επιλογή 2', en: 'Option 2', ru: 'Вариант 2' },
            { el: 'Επιλογή 3', en: 'Option 3', ru: 'Вариант 3' },
          ],
          correct_answer_index: 0,
        },
      },
    ],
    ...overrides,
  };
}

// ============================================
// Tests
// ============================================

describe('ExercisePreviewCard', () => {
  // ============================================
  // Rendering
  // ============================================

  describe('Rendering', () => {
    it('renders prompt and options in Greek', () => {
      renderWithProviders(<ExercisePreviewCard exercise={makeExercise()} />);

      expect(screen.getByTestId('exercise-preview-card')).toBeInTheDocument();
      expect(screen.getByText('Ερώτηση')).toBeInTheDocument();
      expect(screen.getByText('1. Επιλογή 1')).toBeInTheDocument();
      expect(screen.getByText('2. Επιλογή 2')).toBeInTheDocument();
      expect(screen.getByText('3. Επιλογή 3')).toBeInTheDocument();
    });

    it('options are not interactive (no button role)', () => {
      renderWithProviders(<ExercisePreviewCard exercise={makeExercise()} />);

      const buttons = screen.queryAllByRole('button');
      // No option buttons should be present
      expect(buttons).toHaveLength(0);
    });

    it('returns null when items array is empty', () => {
      const exercise = makeExercise({ items: [] });
      renderWithProviders(<ExercisePreviewCard exercise={exercise} />);

      expect(screen.queryByTestId('exercise-preview-card')).not.toBeInTheDocument();
    });
  });

  // ============================================
  // Status badge
  // ============================================

  describe('Status badge', () => {
    it.each<[CardStatus, string]>([
      ['new', 'New'],
      ['learning', 'Learning'],
      ['review', 'Review'],
      ['mastered', 'Mastered'],
    ])('renders status badge for %s', (status, expectedText) => {
      renderWithProviders(<ExercisePreviewCard exercise={makeExercise({ status })} />);

      const badge = screen.getByTestId('exercise-preview-status');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent(expectedText);
    });

    it('status badge "new" has blue classes', () => {
      renderWithProviders(<ExercisePreviewCard exercise={makeExercise({ status: 'new' })} />);

      const badge = screen.getByTestId('exercise-preview-status');
      expect(badge.className).toContain('blue');
    });

    it('status badge "learning" has amber classes', () => {
      renderWithProviders(<ExercisePreviewCard exercise={makeExercise({ status: 'learning' })} />);

      const badge = screen.getByTestId('exercise-preview-status');
      expect(badge.className).toContain('amber');
    });

    it('status badge "review" has purple classes', () => {
      renderWithProviders(<ExercisePreviewCard exercise={makeExercise({ status: 'review' })} />);

      const badge = screen.getByTestId('exercise-preview-status');
      expect(badge.className).toContain('purple');
    });

    it('status badge "mastered" has green classes', () => {
      renderWithProviders(<ExercisePreviewCard exercise={makeExercise({ status: 'mastered' })} />);

      const badge = screen.getByTestId('exercise-preview-status');
      expect(badge.className).toContain('green');
    });
  });

  // ============================================
  // Correct answer styling
  // ============================================

  describe('Correct answer styling', () => {
    it('correct answer option has green styling', () => {
      renderWithProviders(<ExercisePreviewCard exercise={makeExercise()} />);

      const correctOption = screen.getByText('1. Επιλογή 1').closest('div');
      expect(correctOption?.className).toContain('green');
    });

    it('incorrect options do not have green styling', () => {
      renderWithProviders(<ExercisePreviewCard exercise={makeExercise()} />);

      const incorrectOption = screen.getByText('2. Επιλογή 2').closest('div');
      expect(incorrectOption?.className).not.toContain('green');
    });
  });
});
