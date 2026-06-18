// src/components/exercises/__tests__/XdResult.test.tsx
// RED specs for PRACT2-12-05 XdResult result-phase component.
//
// ============================================================
// DOM CONTRACT (executor must satisfy all of these testids):
// ============================================================
//
//   data-testid="xd-result"          — root wrapper
//   data-testid="xd-result-verdict"  — verdict mark (visual check/cross)
//   data-testid="xd-result-answer"   — "The answer" callout element
//   data-testid="xd-result-why"      — Why slot wrapper
//   data-testid="unwired-dot"        — UnwiredDot inside the Why slot
//   Continue button                  — <button> whose text content is "Continue"
//                                      (or has aria-label="Continue")
//
// "The answer" text per exercise_type:
//   select_correct_answer           → options[correct_answer_index][language]
//   select_description_from_picture → options[correct_index].description_text
//   select_picture_from_description → correct picture shown (options[correct_index].image_url),
//                                      no text extracted in tests
//
// "Why" is always an UnwiredDot — explanation is unbacked for all 3 rendered types.
// ============================================================

import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders, screen } from '@/lib/test-utils';
import type { ExerciseQueueItem } from '@/services/exerciseAPI';

import { XdResult } from '../XdResult';

// ---------------------------------------------------------------------------
// Helpers — minimal exercise items per type
// ---------------------------------------------------------------------------

function makeScaItem(): ExerciseQueueItem {
  return {
    exercise_id: 'ex-sca-1',
    source_type: 'description' as const,
    exercise_type: 'select_correct_answer' as const,
    modality: 'reading' as const,
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
    items: [
      {
        item_index: 0,
        payload: {
          prompt: { el: 'Τι είναι;', en: 'What is it?', ru: 'Что это?' },
          options: [
            { el: 'Α', en: 'A', ru: 'А' },
            { el: 'Β', en: 'B', ru: 'Б' },
            { el: 'Γ', en: 'C', ru: 'В' },
          ],
          correct_answer_index: 1,
        },
      },
    ],
  };
}

function makeSdfpItem(): ExerciseQueueItem {
  // select_description_from_picture: anchor image + text options
  return {
    exercise_id: 'ex-sdfp-1',
    source_type: 'picture' as const,
    exercise_type: 'select_description_from_picture' as const,
    modality: 'reading' as const,
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
    items: [
      {
        item_index: 0,
        payload: {
          anchor_image_url: 'https://example.com/house.webp',
          options: [
            {
              option_index: 0,
              image_url: null,
              description_text: 'το αυτοκίνητο',
              image_variants: null,
            },
            {
              option_index: 1,
              image_url: null,
              description_text: 'το σπίτι',
              image_variants: null,
            },
          ],
          correct_index: 1,
        },
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('XdResult', () => {
  // ----------------------------------------------------------
  // Test A: Why slot renders an UnwiredDot for select_correct_answer
  // (no explanation field on SCA — Why is always a red-dot placeholder)
  // ----------------------------------------------------------
  it('why slot is red-dot (UnwiredDot) for select_correct_answer in result phase', () => {
    renderWithProviders(
      <XdResult
        item={makeScaItem()}
        verdict="correct"
        selectedIndex={1}
        language="el"
        onContinue={vi.fn()}
      />
    );

    // Root must exist
    expect(screen.getByTestId('xd-result')).toBeInTheDocument();

    // Why slot must be present
    const whySlot = screen.getByTestId('xd-result-why');
    expect(whySlot).toBeInTheDocument();

    // UnwiredDot must be inside the Why slot
    // (UnwiredDot renders data-testid="unwired-dot")
    expect(whySlot.querySelector('[data-testid="unwired-dot"]')).not.toBeNull();

    // No faked explanation text should appear anywhere
    expect(screen.queryByText(/because|because of|explanation|λόγος/i)).toBeNull();
  });

  // ----------------------------------------------------------
  // Test B: "The answer" callout shows the correct option text for SCA
  // correct_answer_index=1, options[1].el='Β', language='el'
  // → "The answer" callout must contain 'Β'
  // ----------------------------------------------------------
  it('result shows the correct option text for select_correct_answer (el)', () => {
    renderWithProviders(
      <XdResult
        item={makeScaItem()}
        verdict="correct"
        selectedIndex={1}
        language="el"
        onContinue={vi.fn()}
      />
    );

    const answerCallout = screen.getByTestId('xd-result-answer');
    expect(answerCallout).toBeInTheDocument();
    // options[1].el === 'Β' — this is the correct option text
    expect(answerCallout.textContent).toContain('Β');
  });

  // ----------------------------------------------------------
  // Test C: "The answer" callout shows description_text for select_description_from_picture
  // correct_index=1, options[1].description_text='το σπίτι'
  // → "The answer" callout must contain 'το σπίτι'
  // ----------------------------------------------------------
  it('result shows correct description_text for select_description_from_picture', () => {
    renderWithProviders(
      <XdResult
        item={makeSdfpItem()}
        verdict="incorrect"
        selectedIndex={0}
        language="el"
        onContinue={vi.fn()}
      />
    );

    const answerCallout = screen.getByTestId('xd-result-answer');
    expect(answerCallout).toBeInTheDocument();
    // options[1].description_text === 'το σπίτι'
    expect(answerCallout.textContent).toContain('το σπίτι');
  });

  // ----------------------------------------------------------
  // Test D: verdict mark is present and Continue button is rendered
  // (smoke — just ensures the result panel has the required structure)
  // ----------------------------------------------------------
  it('renders verdict mark and Continue button', () => {
    renderWithProviders(
      <XdResult
        item={makeScaItem()}
        verdict="correct"
        selectedIndex={1}
        language="en"
        onContinue={vi.fn()}
      />
    );

    expect(screen.getByTestId('xd-result-verdict')).toBeInTheDocument();
    // Continue button — text or accessible name must be "Continue"
    expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
  });

  // ----------------------------------------------------------
  // Test E: onContinue fires when the Continue button is clicked
  // ----------------------------------------------------------
  it('calls onContinue when Continue button is clicked', async () => {
    const onContinue = vi.fn();
    renderWithProviders(
      <XdResult
        item={makeScaItem()}
        verdict="correct"
        selectedIndex={1}
        language="en"
        onContinue={onContinue}
      />
    );

    const continueBtn = screen.getByRole('button', { name: /continue/i });
    continueBtn.click();

    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  // ----------------------------------------------------------
  // QA adversarial F: select_picture_from_description — answer is an IMAGE
  // The correct option is an image, not a text description.
  // XdResult must show the image (not crash on missing .el / description_text).
  // ----------------------------------------------------------
  it('select_picture_from_description: result shows an img element for the correct picture option', () => {
    const spfdItem: Parameters<typeof XdResult>[0]['item'] = {
      exercise_id: 'ex-spfd-1',
      source_type: 'picture' as const,
      exercise_type: 'select_picture_from_description' as const,
      modality: 'reading' as const,
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
      items: [
        {
          item_index: 0,
          payload: {
            // SPFD: text prompt, picture options
            prompt: { el: 'Σπίτι', en: 'House', ru: 'Дом' },
            options: [
              { image_url: 'https://cdn.example.com/car.webp' },
              { image_url: 'https://cdn.example.com/house.webp' },
            ],
            correct_index: 1,
          },
        },
      ],
    };

    renderWithProviders(
      <XdResult
        item={spfdItem}
        verdict="correct"
        selectedIndex={1}
        language="el"
        onContinue={vi.fn()}
      />
    );

    // Must not crash
    expect(screen.getByTestId('xd-result')).toBeInTheDocument();
    // "The answer" callout must be present
    const answerCallout = screen.getByTestId('xd-result-answer');
    expect(answerCallout).toBeInTheDocument();
    // The correct answer is an image — the callout must contain an <img>
    const img = answerCallout.querySelector('img');
    expect(img).not.toBeNull();
    // Image src must point to the correct option's image_url
    expect(img?.getAttribute('src')).toBe('https://cdn.example.com/house.webp');
    // UnwiredDot still present in Why slot (no .el / description_text → no crash)
    const whySlot = screen.getByTestId('xd-result-why');
    expect(whySlot.querySelector('[data-testid="unwired-dot"]')).not.toBeNull();
  });
});
