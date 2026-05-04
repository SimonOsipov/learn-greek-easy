/**
 * newsJsonValidation Unit Tests
 *
 * Covers scene/style field validation (SPP-06):
 * - scene_en/scene_el paired rule
 * - max-length-1000 check on all three new fields
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
  it('rejects scene_en without scene_el', () => {
    const result = validateNewsItemJson(withExtra({ scene_en: 'A visual scene description' }));
    expect(result).toEqual({
      valid: false,
      error: { type: 'scenePaired', messageKey: 'news.validation.scenePaired' },
    });
  });

  it('rejects scene_el without scene_en', () => {
    const result = validateNewsItemJson(withExtra({ scene_el: 'Οπτική περιγραφή σκηνής' }));
    expect(result).toEqual({
      valid: false,
      error: { type: 'scenePaired', messageKey: 'news.validation.scenePaired' },
    });
  });

  it('accepts both scene_en and scene_el present', () => {
    const result = validateNewsItemJson(
      withExtra({ scene_en: 'A visual scene', scene_el: 'Οπτική σκηνή' })
    );
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.scene_en).toBe('A visual scene');
      expect(result.data.scene_el).toBe('Οπτική σκηνή');
    }
  });

  it('accepts neither scene_en nor scene_el', () => {
    const result = validateNewsItemJson(VALID_BASE);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.scene_en).toBeUndefined();
      expect(result.data.scene_el).toBeUndefined();
    }
  });

  it('accepts style_en independently', () => {
    const result = validateNewsItemJson(withExtra({ style_en: 'Photorealistic, vivid colours' }));
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.style_en).toBe('Photorealistic, vivid colours');
      expect(result.data.scene_en).toBeUndefined();
      expect(result.data.scene_el).toBeUndefined();
    }
  });

  it('rejects scene_en > 1000 chars', () => {
    const longScene = 'a'.repeat(1001);
    const result = validateNewsItemJson(
      withExtra({ scene_en: longScene, scene_el: 'Οπτική σκηνή' })
    );
    expect(result).toEqual({
      valid: false,
      error: { type: 'sceneFieldsTooLong', messageKey: 'news.validation.sceneFieldsTooLong' },
    });
  });

  it('rejects scene_el > 1000 chars', () => {
    const longScene = 'α'.repeat(1001);
    const result = validateNewsItemJson(
      withExtra({ scene_en: 'Visual scene', scene_el: longScene })
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

  it('treats empty-string scene_en as null (paired-violation when scene_el is present)', () => {
    // Trimmed scene_en is empty → treated as null; scene_el is set → paired violation
    const result = validateNewsItemJson(withExtra({ scene_en: '   ', scene_el: 'Οπτική σκηνή' }));
    expect(result).toEqual({
      valid: false,
      error: { type: 'scenePaired', messageKey: 'news.validation.scenePaired' },
    });
  });
});
