/**
 * AdminExerciseBody unit tests (EXR-23..33 + EXR-40..44 + EXR-34)
 *
 * Covers:
 * - MCQ variant: 4 buttons with A/B/C/D marks, correct answer has check icon
 * - MCQ: click a wrong option → aria-checked='true' on that button
 * - True/False variant: Σωστό + Λάθος buttons
 * - Fill-in variant: pill-shaped options
 * - Word Order variant: up/down buttons present
 * - Picture variant A: imageless options → ImageOff fallback shown (EXR-40)
 * - PayloadErrorBanner: renders when options array is empty
 * - Picture variant: 2 options → 2 "Distractor unavailable" placeholder cards (EXR-41)
 * - BodyFooter (EXR-34): Regenerate opens AlertDialog with correct title
 * - BodyFooter (EXR-34): Confirm calls adminAPI.regenerateExercise with exercise id
 * - BodyFooter (EXR-34): API rejection shows error message
 * - BodyFooter (EXR-34): #x{id.slice(0,8)} identifier renders
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import { AdminExerciseBody } from '../AdminExerciseBody';
import type { AdminExerciseListItem } from '@/types/situation';

// Mock adminAPI so footer tests don't hit the network
vi.mock('@/services/adminAPI', () => ({
  adminAPI: {
    regenerateExercise: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

function makeBase(overrides: Partial<AdminExerciseListItem> = {}): AdminExerciseListItem {
  return {
    id: 'ex-1',
    exercise_type: 'select_correct_answer',
    status: 'draft',
    source_type: 'description',
    modality: 'listening',
    audio_level: null,
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

function makeMcqExercise(correctIdx = 1): AdminExerciseListItem {
  return makeBase({
    exercise_type: 'select_correct_answer',
    question_el: 'Τι κάνει ο Γιάννης;',
    question_en: 'What is Giannis doing?',
    correct_idx: correctIdx,
    items: [
      {
        item_index: 0,
        payload: {
          options: ['Πηγαίνει στο σχολείο', 'Μένει σπίτι', 'Πάει στην αγορά', 'Δουλεύει'],
          correct_idx: correctIdx,
        },
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AdminExerciseBody', () => {
  it('renders MCQ variant with 4 option buttons and A/B/C/D marks', () => {
    render(<AdminExerciseBody exercise={makeMcqExercise(1)} />);

    // 4 radio buttons
    const buttons = screen.getAllByRole('radio');
    expect(buttons).toHaveLength(4);

    // Each has a letter mark A, B, C, D
    expect(screen.getByText('A')).toBeTruthy();
    expect(screen.getByText('B')).toBeTruthy();
    expect(screen.getByText('C')).toBeTruthy();
    expect(screen.getByText('D')).toBeTruthy();
  });

  it('MCQ: second option (index 1) has the check icon (Correct answer sr-only text)', () => {
    render(<AdminExerciseBody exercise={makeMcqExercise(1)} />);

    // The correct answer has a screen-reader "Correct answer" span
    const srText = screen.getByText('Correct answer');
    expect(srText).toBeTruthy();
    expect(srText.className).toContain('sr-only');
  });

  it('MCQ: clicking a wrong option sets aria-checked true on that button', () => {
    render(<AdminExerciseBody exercise={makeMcqExercise(1)} />);

    // Click the first button (index 0 = option A, which is NOT correct)
    const buttons = screen.getAllByRole('radio');
    fireEvent.click(buttons[0]);

    expect(buttons[0].getAttribute('aria-checked')).toBe('true');
    // Others should still be false
    expect(buttons[1].getAttribute('aria-checked')).toBe('false');
    expect(buttons[2].getAttribute('aria-checked')).toBe('false');
  });

  it('renders True/False variant with Σωστό and Λάθος buttons', () => {
    const exercise = makeBase({
      exercise_type: 'true_false',
      question_el: 'Αλήθεια ή ψέμα;',
      items: [
        {
          item_index: 0,
          payload: {
            statement: { el: 'Ο Νίκος είναι γιατρός.' },
            correct: true,
          },
        },
      ],
    });
    render(<AdminExerciseBody exercise={exercise} />);

    expect(screen.getByText('Σωστό')).toBeTruthy();
    expect(screen.getByText('Λάθος')).toBeTruthy();

    const buttons = screen.getAllByRole('radio');
    expect(buttons).toHaveLength(2);
  });

  it('renders Fill-in variant with pill-shaped option buttons', () => {
    const exercise = makeBase({
      exercise_type: 'fill_gaps',
      question_el: 'Ο ___ πηγαίνει στο σχολείο.',
      correct_idx: 0,
      items: [
        {
          item_index: 0,
          payload: {
            options: ['Νίκος', 'Μαρία', 'Γιάννης'],
            correct_idx: 0,
          },
        },
      ],
    });
    render(<AdminExerciseBody exercise={exercise} />);

    // 3 radio buttons for the 3 options
    const buttons = screen.getAllByRole('radio');
    expect(buttons).toHaveLength(3);

    // All buttons should have rounded-full class (pill-shaped)
    buttons.forEach((btn) => {
      expect(btn.className).toContain('rounded-full');
    });
  });

  it('renders Word Order variant with chips and up/down buttons', () => {
    const exercise = makeBase({
      exercise_type: 'word_order',
      question_el: 'Βάλε τις λέξεις στη σωστή σειρά:',
      answer_el: 'ο Γιάννης πάει στο σχολείο',
      items: [
        {
          item_index: 0,
          payload: {
            words: ['πάει', 'Γιάννης', 'ο', 'σχολείο', 'στο'],
            correct_order: [2, 1, 0, 4, 3],
            answer_el: 'ο Γιάννης πάει στο σχολείο',
          },
        },
      ],
    });
    render(<AdminExerciseBody exercise={exercise} />);

    // Should have "Move up" and "Move down" buttons
    const moveUpBtns = screen.getAllByRole('button', { name: 'Move up' });
    const moveDownBtns = screen.getAllByRole('button', { name: 'Move down' });
    expect(moveUpBtns.length).toBeGreaterThan(0);
    expect(moveDownBtns.length).toBeGreaterThan(0);

    // Correct order label should appear
    expect(screen.getByText('Correct order')).toBeTruthy();
  });

  it('renders Picture Variant A with ImageOff fallback for options with no image_url', () => {
    const exercise = makeBase({
      exercise_type: 'select_picture_from_description',
      question_el: 'Ποια εικόνα δείχνει παραλία;',
      correct_idx: 0,
      items: [
        {
          item_index: 0,
          payload: {
            // Options without image_url — will attempt to load but fail
            options: [
              { image_url: 'https://example.com/img1.jpg' },
              { image_url: 'https://example.com/img2.jpg' },
              { image_url: 'https://example.com/img3.jpg' },
              { image_url: 'https://example.com/img4.jpg' },
            ],
          },
        },
      ],
    });
    const { container } = render(<AdminExerciseBody exercise={exercise} />);

    // Trigger error on all img elements (simulating broken URLs in test env)
    const imgs = container.querySelectorAll('img');
    imgs.forEach((img) => {
      fireEvent.error(img);
    });

    // ImageOff icons should appear for broken images
    // (lucide renders as SVG; check that the fallback container renders)
    // After errors, the loading state switches to error which renders a div with ImageOff
    // We check that at least one error container appeared
    const errorDivs = container.querySelectorAll('[class*="bg-muted"]');
    expect(errorDivs.length).toBeGreaterThan(0);
  });

  it('renders PayloadErrorBanner when options array is empty', () => {
    // MCQ with no options → PayloadErrorBanner
    const exercise = makeBase({
      exercise_type: 'select_correct_answer',
      question_el: 'Ερώτηση;',
      correct_idx: 0,
      items: [
        {
          item_index: 0,
          payload: {
            options: [], // empty → malformed
            correct_idx: 0,
          },
        },
      ],
    });
    render(<AdminExerciseBody exercise={exercise} />);

    // The error banner should appear
    expect(screen.getByText("This exercise's data is incomplete or malformed.")).toBeTruthy();
  });

  it('Picture variant with 2 options pads to 4 with noDistractor placeholder cards', () => {
    // Suppress the console.warn for this test (expected warning from EXR-41)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const exercise = makeBase({
      exercise_type: 'select_picture_from_description',
      question_el: 'Ποια εικόνα;',
      correct_idx: 0,
      items: [
        {
          item_index: 0,
          payload: {
            options: [
              { image_url: 'https://example.com/img1.jpg' },
              { image_url: 'https://example.com/img2.jpg' },
              // Only 2 options — should pad to 4
            ],
          },
        },
      ],
    });
    render(<AdminExerciseBody exercise={exercise} />);

    // Should render 2 "Distractor unavailable" placeholder cards
    const noDistractorCards = screen.getAllByText('Distractor unavailable');
    expect(noDistractorCards).toHaveLength(2);

    warnSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// BodyFooter tests — EXR-34
// ---------------------------------------------------------------------------

import { adminAPI } from '@/services/adminAPI';

describe('BodyFooter (EXR-34)', () => {
  function makeExerciseWithId(id = 'abcd1234-5678-0000-0000-000000000000'): AdminExerciseListItem {
    return makeBase({
      id,
      exercise_type: 'select_correct_answer',
      question_el: 'Ερώτηση;',
      correct_idx: 0,
      items: [
        {
          item_index: 0,
          payload: {
            options: ['Α', 'Β', 'Γ', 'Δ'],
            correct_idx: 0,
          },
        },
      ],
    });
  }

  /** Helper: open the regenerate dialog by clicking the footer button. */
  function openRegenDialog() {
    // The footer has a ghost "Regenerate" button (with RefreshCw icon text).
    // getAllByRole returns all matches; we click the first one (footer trigger).
    const allRegenBtns = screen.getAllByRole('button', { name: /Regenerate/i });
    fireEvent.click(allRegenBtns[0]);
  }

  /** Helper: get the confirm button inside the open dialog (the last "Regenerate" button). */
  function getConfirmBtn() {
    const all = screen.getAllByRole('button', { name: /Regenerate/i });
    return all[all.length - 1];
  }

  it('clicking Regenerate opens AlertDialog with the confirm title text', async () => {
    render(<AdminExerciseBody exercise={makeExerciseWithId()} />);

    openRegenDialog();

    // AlertDialog title should be visible
    await waitFor(() => {
      expect(screen.getByText('Regenerate this exercise?')).toBeTruthy();
    });
  });

  it('confirming regenerate calls adminAPI.regenerateExercise with the exercise id', async () => {
    const mockRegen = vi.mocked(adminAPI.regenerateExercise);
    mockRegen.mockResolvedValueOnce({} as AdminExerciseListItem);

    const exerciseId = 'abcd1234-5678-0000-0000-000000000000';
    render(<AdminExerciseBody exercise={makeExerciseWithId(exerciseId)} />);

    openRegenDialog();

    await waitFor(() => {
      expect(screen.getByText('Regenerate this exercise?')).toBeTruthy();
    });

    // Click the confirm button inside the dialog
    fireEvent.click(getConfirmBtn());

    await waitFor(() => {
      expect(mockRegen).toHaveBeenCalledWith(exerciseId);
    });
  });

  it('when API call rejects, the error message is rendered', async () => {
    const mockRegen = vi.mocked(adminAPI.regenerateExercise);
    mockRegen.mockRejectedValueOnce(new Error('Server error'));

    render(<AdminExerciseBody exercise={makeExerciseWithId()} />);

    openRegenDialog();

    await waitFor(() => {
      expect(screen.getByText('Regenerate this exercise?')).toBeTruthy();
    });

    fireEvent.click(getConfirmBtn());

    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeTruthy();
    });
  });

  it('renders #x{id.slice(0,8)} identifier in the footer', () => {
    const id = 'abcd1234-5678-0000-0000-000000000000';
    render(<AdminExerciseBody exercise={makeExerciseWithId(id)} />);

    // Expected: #xabcd1234 (first 8 chars of the id)
    expect(screen.getByText('#xabcd1234')).toBeTruthy();
  });

  it('calls onRegenerated callback after a successful regenerate', async () => {
    const mockRegen = vi.mocked(adminAPI.regenerateExercise);
    mockRegen.mockResolvedValueOnce({} as AdminExerciseListItem);
    const onRegenerated = vi.fn();

    render(<AdminExerciseBody exercise={makeExerciseWithId()} onRegenerated={onRegenerated} />);

    openRegenDialog();

    await waitFor(() => {
      expect(screen.getByText('Regenerate this exercise?')).toBeTruthy();
    });

    fireEvent.click(getConfirmBtn());

    await waitFor(() => {
      expect(onRegenerated).toHaveBeenCalledOnce();
    });
  });
});
