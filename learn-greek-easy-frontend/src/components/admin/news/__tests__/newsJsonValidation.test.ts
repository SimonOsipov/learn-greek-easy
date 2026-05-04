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

import { validateNewsItemJson } from '../newsJsonValidation';

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
