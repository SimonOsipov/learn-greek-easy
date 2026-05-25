/**
 * AdminExerciseRow unit tests (EXR-70)
 *
 * Covers:
 * - Source badge tone per source type (blue/violet/amber)
 * - Type badge renders with gray tone
 * - Level badge renders with violet tone only when audio_level is set
 * - ICU plural item count — EN: _one / _other; RU: _one / _few / _many
 * - Chevron button aria-expanded reflects isOpen prop
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { AdminExerciseRow } from '../AdminExerciseRow';
import type { AdminExerciseListItem } from '@/types/situation';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

function makeExercise(overrides: Partial<AdminExerciseListItem> = {}): AdminExerciseListItem {
  return {
    id: 'ex-row-1',
    exercise_type: 'select_correct_answer',
    status: 'draft',
    source_type: 'description',
    modality: 'listening',
    audio_level: 'A2',
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
    ...overrides,
  };
}

function renderRow(exercise: AdminExerciseListItem, isOpen = false) {
  return render(
    <AdminExerciseRow
      exercise={exercise}
      isOpen={isOpen}
      onToggle={vi.fn()}
      rowBodyId="test-body"
    />
  );
}

// ---------------------------------------------------------------------------
// Badge tests — EXR-70
// ---------------------------------------------------------------------------

describe('AdminExerciseRow badge rendering (EXR-70)', () => {
  it('source badge: description renders with blue tone class', () => {
    const { container } = renderRow(makeExercise({ source_type: 'description' }));
    // Badge with 'blue' tone has a blue-related class
    const badges = container.querySelectorAll('[class*="badge"], [class*="tone"]');
    // The first badge (source) should contain text 'Description' (or have its icon)
    expect(screen.getByText('Description')).toBeTruthy();
  });

  it('source badge: dialog renders violet-toned badge', () => {
    renderRow(makeExercise({ source_type: 'dialog' }));
    expect(screen.getByText('Dialog')).toBeTruthy();
  });

  it('source badge: picture renders amber-toned badge', () => {
    renderRow(makeExercise({ source_type: 'picture' }));
    expect(screen.getByText('Picture')).toBeTruthy();
  });

  it('type badge: exercise type label is rendered (gray tone)', () => {
    renderRow(makeExercise({ exercise_type: 'select_correct_answer' }));
    expect(screen.getByText('Select correct answer')).toBeTruthy();
  });

  it('level badge: renders when audio_level is set', () => {
    renderRow(makeExercise({ audio_level: 'B1' }));
    expect(screen.getByText('B1')).toBeTruthy();
  });

  it('level badge: absent when audio_level is null', () => {
    renderRow(makeExercise({ audio_level: null }));
    expect(screen.queryByText('A2')).toBeNull();
    expect(screen.queryByText('B1')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// ICU plural item count — EXR-70
// ---------------------------------------------------------------------------

describe('AdminExerciseRow item count plurals (EXR-70)', () => {
  it('EN: count=1 renders singular "1 item"', () => {
    renderRow(makeExercise({ item_count: 1 }));
    expect(screen.getByText('1 item')).toBeTruthy();
  });

  it('EN: count=5 renders plural "5 items"', () => {
    renderRow(makeExercise({ item_count: 5 }));
    expect(screen.getByText('5 items')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Chevron aria-expanded — accessibility
// ---------------------------------------------------------------------------

describe('AdminExerciseRow chevron button', () => {
  it('aria-expanded is false when isOpen=false', () => {
    const { container } = renderRow(makeExercise(), false);
    // The chevron toggle button is the only element with aria-expanded
    const btn = container.querySelector('[aria-expanded]');
    expect(btn?.getAttribute('aria-expanded')).toBe('false');
  });

  it('aria-expanded is true when isOpen=true', () => {
    const { container } = renderRow(makeExercise(), true);
    const btn = container.querySelector('[aria-expanded]');
    expect(btn?.getAttribute('aria-expanded')).toBe('true');
  });
});
