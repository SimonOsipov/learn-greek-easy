/**
 * newsJsonValidation Unit Tests
 *
 * Covers scene/style field validation:
 * - scene_en/scene_el/scene_ru triple-paired rule
 * - max-length-1000 check on all scene fields and style_en
 * - trim-empty-as-null treatment
 * - style_en accepted independently
 */

import { describe, expect, it } from 'vitest';

import { validateA2Pair, validateNewsItemJson } from '../newsJsonValidation';

/** Minimal valid JSON string for baseline tests */
const VALID_BASE = JSON.stringify({
  country: 'cyprus',
  scenario_el: 'Σενάριο',
  scenario_en: 'Scenario',
  scenario_ru: 'Сценарий',
  text_el: 'Κείμενο',
  publication_date: '2024-01-15',
  original_article_url: 'https://example.com/article',
  source_image_url: 'https://example.com/image.jpg',
});

function withExtra(extra: Record<string, unknown>): string {
  return JSON.stringify({ ...JSON.parse(VALID_BASE), ...extra });
}

describe('validateA2Pair', () => {
  it('returns valid when both scenarioA2 and textA2 are null', () => {
    expect(validateA2Pair({ scenarioA2: null, textA2: null })).toEqual({ valid: true });
  });

  it('returns valid when both scenarioA2 and textA2 are non-null', () => {
    expect(
      validateA2Pair({ scenarioA2: 'Simplified scenario', textA2: 'Simplified text' })
    ).toEqual({ valid: true });
  });

  it('returns invalid when scenarioA2 is set and textA2 is null', () => {
    expect(validateA2Pair({ scenarioA2: 'Simplified scenario', textA2: null })).toEqual({
      valid: false,
      messageKey: 'news.validation.a2FieldsPaired',
    });
  });

  it('returns invalid when textA2 is set and scenarioA2 is null', () => {
    expect(validateA2Pair({ scenarioA2: null, textA2: 'Simplified text' })).toEqual({
      valid: false,
      messageKey: 'news.validation.a2FieldsPaired',
    });
  });
});

describe('validateNewsItemJson — scene/style field validation', () => {
  // --- Single-field rejections ---

  it('rejects scene_en alone', () => {
    const result = validateNewsItemJson(withExtra({ scene_en: 'A visual scene description' }));
    expect(result).toEqual({
      valid: false,
      error: { type: 'scenePaired', messageKey: 'news.validation.scenePaired' },
    });
  });

  it('rejects scene_el alone', () => {
    const result = validateNewsItemJson(withExtra({ scene_el: 'Οπτική περιγραφή σκηνής' }));
    expect(result).toEqual({
      valid: false,
      error: { type: 'scenePaired', messageKey: 'news.validation.scenePaired' },
    });
  });

  it('rejects scene_ru alone', () => {
    const result = validateNewsItemJson(withExtra({ scene_ru: 'Описание сцены' }));
    expect(result).toEqual({
      valid: false,
      error: { type: 'scenePaired', messageKey: 'news.validation.scenePaired' },
    });
  });

  // --- Two-field rejections ---

  it('rejects scene_en + scene_el without scene_ru', () => {
    const result = validateNewsItemJson(
      withExtra({ scene_en: 'A visual scene', scene_el: 'Οπτική σκηνή' })
    );
    expect(result).toEqual({
      valid: false,
      error: { type: 'scenePaired', messageKey: 'news.validation.scenePaired' },
    });
  });

  it('rejects scene_en + scene_ru without scene_el', () => {
    const result = validateNewsItemJson(
      withExtra({ scene_en: 'A visual scene', scene_ru: 'Описание сцены' })
    );
    expect(result).toEqual({
      valid: false,
      error: { type: 'scenePaired', messageKey: 'news.validation.scenePaired' },
    });
  });

  it('rejects scene_el + scene_ru without scene_en', () => {
    const result = validateNewsItemJson(
      withExtra({ scene_el: 'Οπτική σκηνή', scene_ru: 'Описание сцены' })
    );
    expect(result).toEqual({
      valid: false,
      error: { type: 'scenePaired', messageKey: 'news.validation.scenePaired' },
    });
  });

  // --- All-three accept ---

  it('accepts scene_en + scene_el + scene_ru all present', () => {
    const result = validateNewsItemJson(
      withExtra({
        scene_en: 'A visual scene',
        scene_el: 'Οπτική σκηνή',
        scene_ru: 'Описание сцены',
      })
    );
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.scene_en).toBe('A visual scene');
      expect(result.data.scene_el).toBe('Οπτική σκηνή');
      expect(result.data.scene_ru).toBe('Описание сцены');
    }
  });

  // --- None of the three ---

  it('accepts neither scene_en nor scene_el nor scene_ru', () => {
    const result = validateNewsItemJson(VALID_BASE);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.scene_en).toBeUndefined();
      expect(result.data.scene_el).toBeUndefined();
      expect(result.data.scene_ru).toBeUndefined();
    }
  });

  // --- style_en independent ---

  it('accepts style_en independently', () => {
    const result = validateNewsItemJson(withExtra({ style_en: 'Photorealistic, vivid colours' }));
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.style_en).toBe('Photorealistic, vivid colours');
      expect(result.data.scene_en).toBeUndefined();
      expect(result.data.scene_el).toBeUndefined();
      expect(result.data.scene_ru).toBeUndefined();
    }
  });

  // --- Length checks (all three fields must be present to reach length check) ---

  it('rejects scene_en > 1000 chars', () => {
    const longScene = 'a'.repeat(1001);
    const result = validateNewsItemJson(
      withExtra({ scene_en: longScene, scene_el: 'Οπτική σκηνή', scene_ru: 'Описание сцены' })
    );
    expect(result).toEqual({
      valid: false,
      error: { type: 'sceneFieldsTooLong', messageKey: 'news.validation.sceneFieldsTooLong' },
    });
  });

  it('rejects scene_el > 1000 chars', () => {
    const longScene = 'α'.repeat(1001);
    const result = validateNewsItemJson(
      withExtra({ scene_en: 'Visual scene', scene_el: longScene, scene_ru: 'Описание сцены' })
    );
    expect(result).toEqual({
      valid: false,
      error: { type: 'sceneFieldsTooLong', messageKey: 'news.validation.sceneFieldsTooLong' },
    });
  });

  it('rejects scene_ru > 1000 chars', () => {
    const longScene = 'я'.repeat(1001);
    const result = validateNewsItemJson(
      withExtra({ scene_en: 'Visual scene', scene_el: 'Οπτική σκηνή', scene_ru: longScene })
    );
    expect(result).toEqual({
      valid: false,
      error: { type: 'sceneFieldsTooLong', messageKey: 'news.validation.sceneFieldsTooLong' },
    });
  });

  it('rejects style_en > 1000 chars', () => {
    const longStyle = 'a'.repeat(1001);
    const result = validateNewsItemJson(withExtra({ style_en: longStyle }));
    expect(result).toEqual({
      valid: false,
      error: { type: 'sceneFieldsTooLong', messageKey: 'news.validation.sceneFieldsTooLong' },
    });
  });

  // --- Trim-as-null ---

  it('treats empty-string scene_en as null (paired-violation when scene_el + scene_ru present)', () => {
    // Trimmed scene_en is empty → treated as null; scene_el + scene_ru set → paired violation
    const result = validateNewsItemJson(
      withExtra({ scene_en: '   ', scene_el: 'Οπτική σκηνή', scene_ru: 'Описание сцены' })
    );
    expect(result).toEqual({
      valid: false,
      error: { type: 'scenePaired', messageKey: 'news.validation.scenePaired' },
    });
  });
});

describe('validateNewsItemJson — exercise field validation', () => {
  const validExercise = {
    prompt: { el: 'Ποιο είναι;', en: 'Which one?', ru: 'Какой?' },
    options: [
      { el: 'Α', en: 'A', ru: 'А' },
      { el: 'Β', en: 'B', ru: 'Б' },
      { el: 'Γ', en: 'C', ru: 'В' },
      { el: 'Δ', en: 'D', ru: 'Г' },
    ],
    correct_answer_index: 0,
  };

  it('accepts JSON without exercise field', () => {
    const result = validateNewsItemJson(VALID_BASE);
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.data.exercise).toBeUndefined();
  });

  it('accepts and passes through a valid exercise object', () => {
    const result = validateNewsItemJson(withExtra({ exercise: validExercise }));
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.data.exercise).toEqual(validExercise);
  });

  it.each([0, 1, 2, 3, 5, 6])('rejects exercise with %i options', (len) => {
    const options =
      len <= validExercise.options.length
        ? validExercise.options.slice(0, len)
        : [
            ...validExercise.options,
            ...Array.from({ length: len - 4 }, (_, i) => ({
              el: `extra-${i}-el`,
              en: `extra-${i}-en`,
              ru: `extra-${i}-ru`,
            })),
          ];
    const result = validateNewsItemJson(withExtra({ exercise: { ...validExercise, options } }));
    expect(result).toEqual({
      valid: false,
      error: expect.objectContaining({ type: 'invalidExercise' }),
    });
  });

  it.each(['el', 'en', 'ru'] as const)('rejects exercise with prompt missing %s', (lang) => {
    const prompt: Record<string, string> = { ...validExercise.prompt };
    delete prompt[lang];
    const result = validateNewsItemJson(withExtra({ exercise: { ...validExercise, prompt } }));
    expect(result).toEqual({
      valid: false,
      error: expect.objectContaining({ type: 'invalidExercise' }),
    });
  });

  it('rejects exercise where an option is missing a language sub-field', () => {
    const options = validExercise.options.map((o, i) => {
      if (i !== 2) return o;
      const { en: _en, ...rest } = o;
      return rest;
    });
    const result = validateNewsItemJson(withExtra({ exercise: { ...validExercise, options } }));
    expect(result).toEqual({
      valid: false,
      error: expect.objectContaining({ type: 'invalidExercise' }),
    });
  });

  it('rejects exercise where an option language value is empty', () => {
    const options = validExercise.options.map((o, i) => (i === 1 ? { ...o, ru: '' } : o));
    const result = validateNewsItemJson(withExtra({ exercise: { ...validExercise, options } }));
    expect(result).toEqual({
      valid: false,
      error: expect.objectContaining({ type: 'invalidExercise' }),
    });
  });

  it('rejects exercise where prompt.el is whitespace-only', () => {
    const result = validateNewsItemJson(
      withExtra({
        exercise: {
          ...validExercise,
          prompt: { ...validExercise.prompt, el: '   ' },
        },
      })
    );
    expect(result).toEqual({
      valid: false,
      error: expect.objectContaining({ type: 'invalidExercise' }),
    });
  });

  it.each([
    ['negative', -1],
    ['too high (4)', 4],
    ['too high (5)', 5],
    ['non-integer', 1.5],
    ['string "2"', '2'],
  ] as const)('rejects exercise with correct_answer_index %s', (_label, idx) => {
    const result = validateNewsItemJson(
      withExtra({
        exercise: { ...validExercise, correct_answer_index: idx },
      })
    );
    expect(result).toEqual({
      valid: false,
      error: expect.objectContaining({ type: 'invalidExercise' }),
    });
  });

  it.each([
    ['string', 'string'],
    ['array', []],
    ['number', 42],
  ] as const)('rejects exercise that is a %s', (_label, value) => {
    const result = validateNewsItemJson(withExtra({ exercise: value }));
    expect(result).toEqual({
      valid: false,
      error: expect.objectContaining({ type: 'invalidExercise' }),
    });
  });

  it('treats exercise: null as omitted (data.exercise === undefined)', () => {
    const result = validateNewsItemJson(withExtra({ exercise: null }));
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.data.exercise).toBeUndefined();
  });

  it('reports missing-base-field error before exercise error when both are wrong', () => {
    const json = JSON.stringify({
      ...JSON.parse(VALID_BASE),
      country: undefined, // strip required base field — JSON.stringify drops undefined
      exercise: { ...validExercise, options: validExercise.options.slice(0, 3) },
    });
    const result = validateNewsItemJson(json);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error.type).not.toBe('invalidExercise');
    }
  });
});
