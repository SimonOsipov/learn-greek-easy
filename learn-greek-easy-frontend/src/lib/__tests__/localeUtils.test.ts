import { describe, it, expect } from 'vitest';

import { getLocalizedTranslation } from '../localeUtils';

describe('getLocalizedTranslation', () => {
  // English locale
  it('returns English for locale "en"', () => {
    expect(getLocalizedTranslation('hello', 'привет', 'en')).toBe('hello');
  });

  it('returns English for locale "en-US" (regional variant)', () => {
    expect(getLocalizedTranslation('hello', 'привет', 'en-US')).toBe('hello');
  });

  // Russian locale
  it('returns Russian for locale "ru"', () => {
    expect(getLocalizedTranslation('hello', 'привет', 'ru')).toBe('привет');
  });

  // Fallback behavior
  it('falls back to English when Russian is null (locale=ru)', () => {
    expect(getLocalizedTranslation('hello', null, 'ru')).toBe('hello');
  });

  it('falls back to English when Russian is undefined (locale=ru)', () => {
    expect(getLocalizedTranslation('hello', undefined, 'ru')).toBe('hello');
  });

  it('falls back to English when Russian is empty string (locale=ru)', () => {
    expect(getLocalizedTranslation('hello', '', 'ru')).toBe('hello');
  });

  it('falls back to Russian when English is null (locale=en)', () => {
    expect(getLocalizedTranslation(null, 'привет', 'en')).toBe('привет');
  });

  it('falls back to Russian when English is empty string (locale=en)', () => {
    expect(getLocalizedTranslation('', 'привет', 'en')).toBe('привет');
  });

  // Edge cases
  it('returns empty string when both are null', () => {
    expect(getLocalizedTranslation(null, null, 'en')).toBe('');
  });

  it('returns empty string when both are undefined', () => {
    expect(getLocalizedTranslation(undefined, undefined, 'ru')).toBe('');
  });

  it('handles unknown locale by defaulting to English', () => {
    expect(getLocalizedTranslation('hello', 'привет', 'de')).toBe('hello');
  });
});
