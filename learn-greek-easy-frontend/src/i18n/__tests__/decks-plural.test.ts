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
 * Pattern: create a minimal i18next instance from the raw EN admin JSON so that
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

// ---------------------------------------------------------------------------
// Shared fixture: one fresh i18next instance for the whole file
// ---------------------------------------------------------------------------

const i18n = i18next.createInstance();

beforeAll(async () => {
  await i18n.init({
    lng: 'en',
    fallbackLng: 'en',
    defaultNS: 'admin',
    ns: ['admin'],
    resources: {
      en: {
        admin: enAdmin,
      },
    },
    interpolation: {
      escapeValue: false,
    },
    // No saveMissing / missingKeyHandler — absent keys return the key path,
    // so assertions produce clean "expected X, received key.path" failures.
  });
});

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
