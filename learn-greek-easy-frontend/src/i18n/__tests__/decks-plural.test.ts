/**
 * ADMIN2-35-01 — RED specs for decks plural + Deactivated terminology
 *
 * These tests are authored RED (pre-implementation) for task-1004.
 * They verify two acceptance criteria that require new i18n keys in
 * en/admin.json:
 *   - AC-6: decks.wordCount plural resolves correctly (count:1 → "1 word", count:3 → "3 words")
 *   - AC-7: decks.statusDeactivated = "Deactivated" and deckEdit.isActiveDescription
 *           contains "Deactivated" (not "Inactive")
 *
 * Adversarial coverage (added in Mode B / QA verify pass):
 *   - RU CLDR plural family for wordCount: count=1 (one), 2 (few), 5 (many), 21 (one)
 *   - Filter keys resolve to translated strings (not key paths) in both locales
 *   - No stray "Inactive" in the decks / deckEdit namespaces of EN admin
 *
 * Pattern: create a minimal i18next instance from the raw admin JSON so that
 * plural resolution is exercised via the real i18next engine. We do NOT reuse
 * the shared test-setup singleton (it uses throw-mode missingKeyHandler which
 * turns missing keys into errors — not assertion failures). A fresh instance
 * with no saveMissing returns the key path for absent keys, so assertions like
 * toBe("1 word") fail cleanly with "received: 'decks.wordCount'" when the key
 * is absent.
 */
import i18next from 'i18next';
import { describe, it, expect, beforeAll } from 'vitest';

import enAdmin from '../locales/en/admin.json';
import ruAdmin from '../locales/ru/admin.json';

// ---------------------------------------------------------------------------
// Shared fixtures: separate fresh i18next instances per locale
// ---------------------------------------------------------------------------

const i18nEn = i18next.createInstance();
const i18nRu = i18next.createInstance();

beforeAll(async () => {
  await i18nEn.init({
    lng: 'en',
    fallbackLng: 'en',
    defaultNS: 'admin',
    ns: ['admin'],
    resources: {
      en: { admin: enAdmin },
    },
    interpolation: { escapeValue: false },
  });

  await i18nRu.init({
    lng: 'ru',
    fallbackLng: 'ru',
    defaultNS: 'admin',
    ns: ['admin'],
    resources: {
      ru: { admin: ruAdmin },
    },
    interpolation: { escapeValue: false },
  });
});

// Convenience alias for the EN-only tests that existed before Mode B
const i18n = i18nEn;

// ---------------------------------------------------------------------------
// AC-6 / TEST SPEC word_count_plural_resolves
// ---------------------------------------------------------------------------

describe('word_count_plural_resolves', () => {
  it('t(decks.wordCount, {count:1}) resolves to "1 word"', () => {
    const result = i18n.t('decks.wordCount', { count: 1 });
    expect(result).toBe('1 word');
  });

  it('t(decks.wordCount, {count:3}) resolves to "3 words"', () => {
    const result = i18n.t('decks.wordCount', { count: 3 });
    expect(result).toBe('3 words');
  });
});

// ---------------------------------------------------------------------------
// AC-7 / TEST SPEC deactivated_terminology_present
// ---------------------------------------------------------------------------

describe('deactivated_terminology_present', () => {
  it('t(decks.statusDeactivated) resolves to "Deactivated"', () => {
    const result = i18n.t('decks.statusDeactivated');
    expect(result).toBe('Deactivated');
  });

  it('t(deckEdit.isActiveDescription) contains "Deactivated"', () => {
    const result = i18n.t('deckEdit.isActiveDescription');
    expect(result).toContain('Deactivated');
  });

  it('t(deckEdit.isActiveDescription) does NOT contain "Inactive"', () => {
    const result = i18n.t('deckEdit.isActiveDescription');
    expect(result).not.toContain('Inactive');
  });
});

// ---------------------------------------------------------------------------
// ADVERSARIAL: RU CLDR plural family (count=1/2/5/21)
// RU rules: one = n%10==1 && n%100!=11; few = n%10∈{2,3,4} && n%100∉{12,13,14};
//           many = everything else (incl. 0, 5–20, 11–14, multiples of 10)
// ---------------------------------------------------------------------------

describe('ru_word_count_plural_cldr_family', () => {
  it('count=1 → one form ("1 слово")', () => {
    expect(i18nRu.t('decks.wordCount', { count: 1 })).toBe('1 слово');
  });

  it('count=2 → few form ("2 слова")', () => {
    expect(i18nRu.t('decks.wordCount', { count: 2 })).toBe('2 слова');
  });

  it('count=5 → many form ("5 слов")', () => {
    expect(i18nRu.t('decks.wordCount', { count: 5 })).toBe('5 слов');
  });

  it('count=21 → one form ("21 слово") — the classic RU trap (21 not 11)', () => {
    expect(i18nRu.t('decks.wordCount', { count: 21 })).toBe('21 слово');
  });
});

// ---------------------------------------------------------------------------
// ADVERSARIAL: filter keys resolve to translated strings in BOTH locales
// (guard against a key being present but falling back to the key path)
// ---------------------------------------------------------------------------

describe('filter_keys_resolve_both_locales', () => {
  it('EN decks.filters.status.deactivated resolves to a non-key string', () => {
    const result = i18nEn.t('decks.filters.status.deactivated');
    expect(result).not.toContain('decks.filters.status.deactivated');
    expect(result.length).toBeGreaterThan(0);
  });

  it('RU decks.filters.status.deactivated resolves to a non-key string', () => {
    const result = i18nRu.t('decks.filters.status.deactivated');
    expect(result).not.toContain('decks.filters.status.deactivated');
    expect(result.length).toBeGreaterThan(0);
  });

  it('EN decks.filters.type.vocab resolves to a non-key string', () => {
    const result = i18nEn.t('decks.filters.type.vocab');
    expect(result).not.toContain('decks.filters.type.vocab');
    expect(result.length).toBeGreaterThan(0);
  });

  it('RU decks.filters.type.vocab resolves to a non-key string', () => {
    const result = i18nRu.t('decks.filters.type.vocab');
    expect(result).not.toContain('decks.filters.type.vocab');
    expect(result.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// ADVERSARIAL: no stray "Inactive" under decks / deckEdit in EN admin
// Guards the F4 terminology standardization.
//
// decks.statusInactive is the ONE known deferred removal (subtask 04 will
// delete it once its consumer is gone). All OTHER values in decks.* and every
// value in deckEdit.* must not contain "Inactive" — if new code reintroduces
// it, this test fails.
// ---------------------------------------------------------------------------

describe('no_inactive_terminology_leak_en', () => {
  function collectValues(
    obj: Record<string, unknown>,
    path = ''
  ): Array<{ path: string; value: string }> {
    const results: Array<{ path: string; value: string }> = [];
    for (const [k, v] of Object.entries(obj)) {
      const full = path ? `${path}.${k}` : k;
      if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
        results.push(...collectValues(v as Record<string, unknown>, full));
      } else if (typeof v === 'string') {
        results.push({ path: full, value: v });
      }
    }
    return results;
  }

  // Deferred removals from subtask 04 — do not assert clean on these yet.
  const DEFERRED_INACTIVE_KEYS = new Set(['statusInactive']);

  it('no EN admin.decks value (excluding deferred removals) contains "Inactive" (case-insensitive)', () => {
    const decksSection = (enAdmin as Record<string, unknown>)['decks'] as Record<string, unknown>;
    const leaks = collectValues(decksSection).filter(
      ({ path, value }) =>
        !DEFERRED_INACTIVE_KEYS.has(path) && value.toLowerCase().includes('inactive')
    );
    expect(
      leaks,
      `Found unexpected "Inactive" in en/admin.json decks.*:\n${leaks.map((l) => `  ${l.path}: ${l.value}`).join('\n')}`
    ).toHaveLength(0);
  });

  it('no EN admin.deckEdit value contains "Inactive" (case-insensitive)', () => {
    const deckEditSection = (enAdmin as Record<string, unknown>)['deckEdit'] as Record<
      string,
      unknown
    >;
    const leaks = collectValues(deckEditSection).filter(({ value }) =>
      value.toLowerCase().includes('inactive')
    );
    expect(
      leaks,
      `Found "Inactive" in en/admin.json deckEdit.*:\n${leaks.map((l) => `  ${l.path}: ${l.value}`).join('\n')}`
    ).toHaveLength(0);
  });

  it('exactly one deferred "Inactive" key remains in decks (statusInactive — removed in subtask 04)', () => {
    const decksSection = (enAdmin as Record<string, unknown>)['decks'] as Record<string, unknown>;
    const allInactive = collectValues(decksSection).filter(({ value }) =>
      value.toLowerCase().includes('inactive')
    );
    // There must be exactly the one deferred key — no more were reintroduced.
    expect(
      allInactive.map((l) => l.path),
      `Expected only 'statusInactive' to remain; got:\n${allInactive.map((l) => `  ${l.path}: ${l.value}`).join('\n')}`
    ).toEqual(['statusInactive']);
  });
});
