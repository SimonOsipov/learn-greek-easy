/**
 * DX-13 — deck namespace i18n parity tests
 *
 * Asserts:
 *  1. EN deck.json key set === RU deck.json key set (deep recursive parity).
 *  2. Every new DX key introduced by DX-13 is present in both locales.
 *  3. Every key whose EN value contains {{...}} interpolation placeholders
 *     has the same set of placeholder names in the RU value.
 *
 * Does NOT rely on i18n.test.ts — that file only verifies bundles load.
 */

import { describe, it, expect } from 'vitest';

import enDeck from '../locales/en/deck.json';
import ruDeck from '../locales/ru/deck.json';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Recursively collect all dot-separated key paths from a (possibly nested) object.
 */
function collectKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...collectKeys(v as Record<string, unknown>, full));
    } else {
      keys.push(full);
    }
  }
  return keys;
}

/**
 * Extract all {{placeholder}} names from a string value.
 */
function extractPlaceholders(value: string): string[] {
  const matches = value.match(/\{\{(\w+)\}\}/g) ?? [];
  return [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, '')))].sort();
}

/**
 * Recursively get a value from a nested object by dot-separated key path.
 */
function getNestedValue(obj: Record<string, unknown>, keyPath: string): unknown {
  return keyPath.split('.').reduce<unknown>((acc, part) => {
    if (acc !== null && typeof acc === 'object' && !Array.isArray(acc)) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('deck namespace — EN/RU key-set parity', () => {
  const enKeys = collectKeys(enDeck as unknown as Record<string, unknown>).sort();
  const ruKeys = collectKeys(ruDeck as unknown as Record<string, unknown>).sort();

  it('EN and RU have identical key count', () => {
    expect(enKeys.length).toBe(ruKeys.length);
  });

  it('every EN key exists in RU', () => {
    const missingInRu = enKeys.filter((k) => !ruKeys.includes(k));
    expect(missingInRu).toEqual([]);
  });

  it('every RU key exists in EN', () => {
    const missingInEn = ruKeys.filter((k) => !enKeys.includes(k));
    expect(missingInEn).toEqual([]);
  });
});

describe('deck.dx — DX-13 new keys present in both locales', () => {
  const DX_KEYS = [
    'dx.vocabularyKicker',
    'dx.resumeStatTotalWords',
    'dx.resumeStatMastered',
    'dx.resumeStatComplete',
    'dx.coverTagVocabulary',
    'dx.weekHeatLabel',
    'dx.donutRingLabel',
    'dx.unwiredTooltip',
    'dx.unwiredExtraGloss',
    'dx.unwiredHeatmap',
    'dx.unwiredExampleTag',
    'dx.unwiredCollocations',
    'dx.unwiredRelated',
    'dx.unwiredAudioGroup',
    'dx.premiumContent',
    'dx.masteryStatus',
    'wordReference.extraGlossPlaceholder',
  ];

  for (const key of DX_KEYS) {
    it(`"${key}" is present in EN deck.json`, () => {
      const value = getNestedValue(enDeck as unknown as Record<string, unknown>, key);
      expect(value).toBeDefined();
      expect(typeof value).toBe('string');
    });

    it(`"${key}" is present in RU deck.json`, () => {
      const value = getNestedValue(ruDeck as unknown as Record<string, unknown>, key);
      expect(value).toBeDefined();
      expect(typeof value).toBe('string');
    });
  }
});

describe('deck namespace — interpolation placeholder parity (EN === RU)', () => {
  const enObj = enDeck as unknown as Record<string, unknown>;
  const ruObj = ruDeck as unknown as Record<string, unknown>;
  const enKeys = collectKeys(enObj);

  // Only test keys whose EN value contains at least one placeholder
  const keysWithPlaceholders = enKeys.filter((key) => {
    const val = getNestedValue(enObj, key);
    return typeof val === 'string' && val.includes('{{');
  });

  it('there are keys with interpolation placeholders to test', () => {
    expect(keysWithPlaceholders.length).toBeGreaterThan(0);
  });

  for (const key of keysWithPlaceholders) {
    it(`"${key}" has matching placeholder names in EN and RU`, () => {
      const enVal = getNestedValue(enObj, key) as string;
      const ruVal = getNestedValue(ruObj, key);

      // RU key must exist (covered by parity tests above, but be explicit)
      expect(typeof ruVal).toBe('string');

      const enPlaceholders = extractPlaceholders(enVal);
      const ruPlaceholders = extractPlaceholders(ruVal as string);

      expect(ruPlaceholders).toEqual(enPlaceholders);
    });
  }
});
