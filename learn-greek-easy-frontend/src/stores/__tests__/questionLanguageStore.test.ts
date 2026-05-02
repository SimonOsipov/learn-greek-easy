// src/stores/__tests__/questionLanguageStore.test.ts

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { migrateLegacyLanguage, useQuestionLanguageStore } from '@/stores/questionLanguageStore';

vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
}));

import { track } from '@/lib/analytics';

const LEGACY_KEY = 'culture_question_language';

describe('questionLanguageStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useQuestionLanguageStore.setState({ language: 'en' });
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('default value is en', () => {
    expect(useQuestionLanguageStore.getState().language).toBe('en');
  });

  it('setLanguage updates the value', () => {
    useQuestionLanguageStore.getState().setLanguage('el');
    expect(useQuestionLanguageStore.getState().language).toBe('el');
  });

  it('setLanguage is a no-op when value is unchanged', () => {
    useQuestionLanguageStore.setState({ language: 'ru' });
    useQuestionLanguageStore.getState().setLanguage('ru');
    expect(track).not.toHaveBeenCalled();
  });

  it('analytics event fires with correct from_lang, to_lang, source', () => {
    useQuestionLanguageStore.setState({ language: 'en' });
    useQuestionLanguageStore.getState().setLanguage('el', 'culture');
    expect(track).toHaveBeenCalledWith('question_language_changed', {
      from_lang: 'en',
      to_lang: 'el',
      source: 'culture',
    });
  });

  it('analytics source defaults to unknown when not passed', () => {
    useQuestionLanguageStore.setState({ language: 'en' });
    useQuestionLanguageStore.getState().setLanguage('ru');
    expect(track).toHaveBeenCalledWith('question_language_changed', {
      from_lang: 'en',
      to_lang: 'ru',
      source: 'unknown',
    });
  });

  it('rejects invalid language values', () => {
    useQuestionLanguageStore.setState({ language: 'en' });
    useQuestionLanguageStore.getState().setLanguage('de' as never);
    expect(useQuestionLanguageStore.getState().language).toBe('en');
    expect(track).not.toHaveBeenCalled();
  });
});

describe('migrateLegacyLanguage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('returns null when no legacy key exists', () => {
    expect(migrateLegacyLanguage()).toBeNull();
  });

  it('returns the legacy language and removes the key for a valid value', () => {
    localStorage.setItem(LEGACY_KEY, 'ru');
    const result = migrateLegacyLanguage();
    expect(result).toBe('ru');
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull();
  });

  it('returns null and does not remove the key for an invalid value', () => {
    localStorage.setItem(LEGACY_KEY, 'de');
    const result = migrateLegacyLanguage();
    expect(result).toBeNull();
  });

  it('handles el as a valid legacy value', () => {
    localStorage.setItem(LEGACY_KEY, 'el');
    const result = migrateLegacyLanguage();
    expect(result).toBe('el');
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull();
  });

  it('handles en as a valid legacy value', () => {
    localStorage.setItem(LEGACY_KEY, 'en');
    const result = migrateLegacyLanguage();
    expect(result).toBe('en');
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull();
  });
});
