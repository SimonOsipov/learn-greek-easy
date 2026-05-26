/**
 * ExerciseItemPayload unit tests (TBR2-25-08)
 *
 * Covers one branch per exercise type (select_correct_answer, fill_gaps,
 * true_false, select_heard, word_order) plus the correct-answer badge.
 *
 * ExerciseItemPayload is type-agnostic in its rendering: it dispatches on
 * payload shape (options array, correct_answer_index, etc.) rather than on
 * exerciseType. The PICTURE_MATCH types get a separate PictureMatchBody branch.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { ExerciseItemPayload } from '../ExerciseItemPayload';

// Mock WaveformPlayer — requires audio context which is unavailable in jsdom
vi.mock('@/components/culture/WaveformPlayer', () => ({
  WaveformPlayer: ({ audioUrl }: { audioUrl: string }) => (
    <div data-testid="waveform-player" data-audio-url={audioUrl} />
  ),
}));

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

function mcqPayload(correctIndex = 0) {
  return {
    prompt: 'Ποια είναι η σωστή απάντηση;',
    options: ['Γεια', 'Καλημέρα', 'Αντίο', 'Ευχαριστώ'],
    correct_answer_index: correctIndex,
  };
}

function fillGapsPayload() {
  return {
    question_text: 'Συμπλήρωσε το κενό: Πώς ___ στη δουλειά;',
    options: ['πηγαίνεις', 'πηγαίνει', 'πηγαίνω'],
    correct_answer_index: 0,
  };
}

function trueFalsePayload() {
  return {
    prompt: 'Το Athens είναι η πρωτεύουσα της Ελλάδας.',
    options: ['Σωστό', 'Λάθος'],
    correct_answer_index: 0,
  };
}

function wordOrderPayload() {
  return {
    text: 'Βάλε τις λέξεις στη σωστή σειρά.',
    options: ['εγώ', 'πηγαίνω', 'σχολείο', 'στο'],
    correct_answer_index: 0,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ExerciseItemPayload — SELECT_CORRECT_ANSWER', () => {
  it('renders question text and four options', () => {
    render(<ExerciseItemPayload exerciseType="select_correct_answer" payload={mcqPayload()} />);
    expect(screen.getByText('Ποια είναι η σωστή απάντηση;')).toBeTruthy();
    expect(screen.getByText('Γεια')).toBeTruthy();
    expect(screen.getByText('Καλημέρα')).toBeTruthy();
    expect(screen.getByText('Αντίο')).toBeTruthy();
    expect(screen.getByText('Ευχαριστώ')).toBeTruthy();
  });
});

describe('ExerciseItemPayload — FILL_IN_THE_BLANK (fill_gaps)', () => {
  it('renders question text and options', () => {
    render(<ExerciseItemPayload exerciseType="fill_gaps" payload={fillGapsPayload()} />);
    expect(screen.getByText('Συμπλήρωσε το κενό: Πώς ___ στη δουλειά;')).toBeTruthy();
    expect(screen.getByText('πηγαίνεις')).toBeTruthy();
  });
});

describe('ExerciseItemPayload — TRUE_FALSE (true_false)', () => {
  it('renders the prompt and Σωστό/Λάθος options', () => {
    render(<ExerciseItemPayload exerciseType="true_false" payload={trueFalsePayload()} />);
    expect(screen.getByText('Το Athens είναι η πρωτεύουσα της Ελλάδας.')).toBeTruthy();
    expect(screen.getByText('Σωστό')).toBeTruthy();
    expect(screen.getByText('Λάθος')).toBeTruthy();
  });
});

describe('ExerciseItemPayload — WHAT_YOU_HEARD (select_heard)', () => {
  it('renders the WaveformPlayer when audioUrl is provided', () => {
    render(
      <ExerciseItemPayload
        exerciseType="select_heard"
        payload={mcqPayload(1)}
        audioUrl="https://cdn.example.com/audio.mp3"
      />
    );
    expect(screen.getByTestId('waveform-player')).toBeTruthy();
  });

  it('renders options for select_heard', () => {
    render(
      <ExerciseItemPayload
        exerciseType="select_heard"
        payload={mcqPayload(1)}
        audioUrl="https://cdn.example.com/audio.mp3"
      />
    );
    expect(screen.getByText('Καλημέρα')).toBeTruthy();
  });
});

describe('ExerciseItemPayload — WORD_ORDER', () => {
  it('renders the prompt and word tiles', () => {
    render(<ExerciseItemPayload exerciseType="word_order" payload={wordOrderPayload()} />);
    expect(screen.getByText('Βάλε τις λέξεις στη σωστή σειρά.')).toBeTruthy();
    expect(screen.getByText('εγώ')).toBeTruthy();
    expect(screen.getByText('πηγαίνω')).toBeTruthy();
  });
});

describe('ExerciseItemPayload — correct answer badge', () => {
  it('highlights the correct option (correct_answer_index=0 → first option)', () => {
    const { container } = render(
      <ExerciseItemPayload exerciseType="select_correct_answer" payload={mcqPayload(0)} />
    );
    // Correct option has bg-success/10 applied via cn()
    const optionDivs = container.querySelectorAll('.grid > div');
    // First option should contain "success" classes; others should not
    expect(optionDivs[0].className).toContain('bg-success');
    expect(optionDivs[1].className).not.toContain('bg-success');
  });

  it('highlights a non-first option when correct_answer_index=2', () => {
    const { container } = render(
      <ExerciseItemPayload exerciseType="select_correct_answer" payload={mcqPayload(2)} />
    );
    const optionDivs = container.querySelectorAll('.grid > div');
    expect(optionDivs[0].className).not.toContain('bg-success');
    expect(optionDivs[2].className).toContain('bg-success');
  });
});
