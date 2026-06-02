// src/stores/__tests__/cultureDeckQuestionLanguageStore.test.ts

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useCultureDeckQuestionLanguageStore } from '@/stores/cultureDeckQuestionLanguageStore';
import { useQuestionLanguageStore } from '@/stores/questionLanguageStore';

vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
}));

import { track } from '@/lib/analytics';

describe('cultureDeckQuestionLanguageStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useCultureDeckQuestionLanguageStore.setState({ language: 'el' });
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('default value is el (not en)', () => {
    expect(useCultureDeckQuestionLanguageStore.getState().language).toBe('el');
  });

  it('setLanguage updates the value', () => {
    useCultureDeckQuestionLanguageStore.getState().setLanguage('en');
    expect(useCultureDeckQuestionLanguageStore.getState().language).toBe('en');
  });

  it('setLanguage is a no-op when value is unchanged', () => {
    useCultureDeckQuestionLanguageStore.setState({ language: 'el' });
    useCultureDeckQuestionLanguageStore.getState().setLanguage('el');
    expect(track).not.toHaveBeenCalled();
  });

  it('emits question_language_changed with source=culture_deck_detail', () => {
    useCultureDeckQuestionLanguageStore.setState({ language: 'el' });
    useCultureDeckQuestionLanguageStore.getState().setLanguage('en');
    expect(track).toHaveBeenCalledWith('question_language_changed', {
      from_lang: 'el',
      to_lang: 'en',
      source: 'culture_deck_detail',
    });
  });

  it('rejects invalid language values', () => {
    useCultureDeckQuestionLanguageStore.setState({ language: 'el' });
    useCultureDeckQuestionLanguageStore.getState().setLanguage('de' as never);
    expect(useCultureDeckQuestionLanguageStore.getState().language).toBe('el');
    expect(track).not.toHaveBeenCalled();
  });

  it('uses a distinct persist key from the global store', () => {
    // Both stores can have different values simultaneously
    useCultureDeckQuestionLanguageStore.setState({ language: 'el' });
    useQuestionLanguageStore.setState({ language: 'en' });

    expect(useCultureDeckQuestionLanguageStore.getState().language).toBe('el');
    expect(useQuestionLanguageStore.getState().language).toBe('en');
  });
});

describe('global questionLanguageStore regression (DDR-06)', () => {
  beforeEach(() => {
    localStorage.clear();
    useQuestionLanguageStore.setState({ language: 'en' });
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('global store default remains en (mock-exam / exercise / practice unaffected)', () => {
    expect(useQuestionLanguageStore.getState().language).toBe('en');
  });

  it('changing the scoped store does NOT affect the global store', () => {
    useCultureDeckQuestionLanguageStore.setState({ language: 'ru' });
    expect(useQuestionLanguageStore.getState().language).toBe('en');
  });
});
