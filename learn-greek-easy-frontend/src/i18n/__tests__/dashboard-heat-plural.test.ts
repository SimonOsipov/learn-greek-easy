/**
 * DASH2-01-08 — welcome.heatReviews CLDR plural resolution (week-heat strip).
 *
 * The DASH2-01-02 heat strip originally selected the plural form with a manual
 * `h === 1 ? _one : _other` conditional, which cannot express Russian's THREE
 * count forms (one / few / many) — so days with 2–4 reviews rendered the wrong
 * form ("2 повторений" instead of "2 повторения"). The fix switches the call
 * site to native i18next count-based pluralization (`t('welcome.heatReviews',
 * { count })`) backed by the full RU plural family, matching the established
 * `decks.wordCount` pattern (decks-plural.test.ts).
 *
 * Pattern: fresh per-locale i18next instances over the raw common.json so CLDR
 * plural resolution is exercised by the real engine (no shared throw-mode setup).
 */
import i18next from 'i18next';
import { describe, it, expect, beforeAll } from 'vitest';

import enCommon from '../locales/en/common.json';
import ruCommon from '../locales/ru/common.json';

const i18nEn = i18next.createInstance();
const i18nRu = i18next.createInstance();

beforeAll(async () => {
  await i18nEn.init({
    lng: 'en',
    fallbackLng: 'en',
    defaultNS: 'common',
    ns: ['common'],
    resources: { en: { common: enCommon } },
    interpolation: { escapeValue: false },
  });

  await i18nRu.init({
    lng: 'ru',
    fallbackLng: 'ru',
    defaultNS: 'common',
    ns: ['common'],
    resources: { ru: { common: ruCommon } },
    interpolation: { escapeValue: false },
  });
});

describe('en_heat_reviews_plural', () => {
  it('count=1 → "1 review"', () => {
    expect(i18nEn.t('welcome.heatReviews', { count: 1 })).toBe('1 review');
  });

  it('count=3 → "3 reviews"', () => {
    expect(i18nEn.t('welcome.heatReviews', { count: 3 })).toBe('3 reviews');
  });

  it('count=0 → "0 reviews"', () => {
    expect(i18nEn.t('welcome.heatReviews', { count: 0 })).toBe('0 reviews');
  });
});

// RU rules: one = n%10==1 && n%100!=11; few = n%10∈{2,3,4} && n%100∉{12,13,14};
// many = everything else (incl. 0, 5–20, multiples of 10).
describe('ru_heat_reviews_plural_cldr_family', () => {
  it('count=1 → one form ("1 повторение")', () => {
    expect(i18nRu.t('welcome.heatReviews', { count: 1 })).toBe('1 повторение');
  });

  it('count=2 → few form ("2 повторения") — the bug this fix targets', () => {
    expect(i18nRu.t('welcome.heatReviews', { count: 2 })).toBe('2 повторения');
  });

  it('count=4 → few form ("4 повторения")', () => {
    expect(i18nRu.t('welcome.heatReviews', { count: 4 })).toBe('4 повторения');
  });

  it('count=5 → many form ("5 повторений")', () => {
    expect(i18nRu.t('welcome.heatReviews', { count: 5 })).toBe('5 повторений');
  });

  it('count=11 → many form ("11 повторений") — n%100==11 is NOT one', () => {
    expect(i18nRu.t('welcome.heatReviews', { count: 11 })).toBe('11 повторений');
  });

  it('count=21 → one form ("21 повторение") — the classic RU trap (21 not 11)', () => {
    expect(i18nRu.t('welcome.heatReviews', { count: 21 })).toBe('21 повторение');
  });

  it('count=0 → many form ("0 повторений")', () => {
    expect(i18nRu.t('welcome.heatReviews', { count: 0 })).toBe('0 повторений');
  });
});
